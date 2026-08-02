'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { configuracaoEmail, enviarEmail, testarConexao } from '@/lib/email/enviar'
import { PROVEDOR_EMAIL, SERVIDOR_PADRAO, type ProvedorEmail } from '@/lib/email/provedores'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

/** Marcador de senha já salva. A senha real nunca volta para a tela — ver `carregarConfiguracao`. */
const SENHA_MASCARADA = '••••••••'

const esquema = z.object({
  provedor: z.enum([PROVEDOR_EMAIL.GMAIL, PROVEDOR_EMAIL.OUTLOOK, PROVEDOR_EMAIL.OUTRO]),
  host: opcional,
  porta: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  usuario: z.string().trim().email('Informe o e-mail da conta que vai enviar.'),
  senha: z.string().min(1, 'Informe a senha de aplicativo.'),
  remetente: opcional,
  destinatarioPadrao: z.union([z.string().trim().email('E-mail do comprador inválido.'), z.literal('')]).optional(),
  copiaPara: z.union([z.string().trim().email('E-mail de cópia inválido.'), z.literal('')]).optional(),
  enviarAutomatico: z.coerce.boolean().default(true),
})

export async function salvarConfiguracaoEmail(entrada: unknown): Promise<Resultado> {
  await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data
  const provedor = d.provedor as ProvedorEmail
  const padrao = SERVIDOR_PADRAO[provedor]

  // Provedor conhecido manda no servidor: se alguém escolher Gmail e digitar outro host, o
  // envio falharia com um erro de rede que não sugere a causa.
  const host = provedor === PROVEDOR_EMAIL.OUTRO ? (d.host ?? '') : padrao.host
  const porta = provedor === PROVEDOR_EMAIL.OUTRO ? (typeof d.porta === 'number' ? d.porta : 587) : padrao.porta

  if (!host) return { ok: false, erro: 'Informe o endereço do servidor de saída (SMTP).' }

  try {
    const atual = await prisma.configuracaoEmail.findUnique({ where: { id: 'unica' } })

    // A tela devolve o marcador quando o usuário não mexeu na senha. Gravar o marcador
    // apagaria a senha boa e quebraria o envio sem ninguém ter mudado nada de propósito.
    const senha = d.senha === SENHA_MASCARADA && atual ? atual.senha : d.senha

    const dados = {
      provedor,
      host,
      porta,
      usuario: d.usuario,
      senha,
      remetente: d.remetente ?? null,
      destinatarioPadrao: d.destinatarioPadrao || null,
      copiaPara: d.copiaPara || null,
      enviarAutomatico: d.enviarAutomatico,
      ativo: true,
      // Mudou a configuração, o teste anterior não vale mais.
      testadoEm: null,
    }

    await prisma.configuracaoEmail.upsert({
      where: { id: 'unica' },
      update: dados,
      create: { id: 'unica', ...dados },
    })

    revalidarTelas('/configuracoes', '/solicitacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar a configuração.' }
  }
}

/**
 * Testa a conexão e manda um e-mail de teste para a própria conta.
 *
 * Os dois passos existem porque conectar não é o mesmo que conseguir entregar: o servidor
 * pode aceitar o login e recusar o envio. Testar de verdade é o que evita descobrir o
 * problema só quando o pedido de compra real não chegar ao fornecedor.
 */
export async function testarEnvioEmail(): Promise<Resultado<{ enviadoPara: string }>> {
  await exigirSessao()

  const config = await configuracaoEmail()
  if (!config) return { ok: false, erro: 'Salve a configuração antes de testar.' }

  const conexao = await testarConexao(config)
  if (!conexao.ok) return { ok: false, erro: conexao.erro }

  const destino = config.destinatarioPadrao || config.usuario
  const envio = await enviarEmail({
    para: destino,
    assunto: 'Teste de envio — Almoxarifado Siqueira Campos',
    corpo:
      'Este é um e-mail de teste do sistema de Almoxarifado.\n\n' +
      'Se você recebeu esta mensagem, as solicitações de compra vão sair normalmente por ' +
      'esta conta.\n\nNão é preciso responder.',
  })
  if (!envio.ok) return { ok: false, erro: envio.erro }

  await prisma.configuracaoEmail.update({
    where: { id: 'unica' },
    data: { testadoEm: new Date() },
  })

  revalidarTelas('/configuracoes')
  return { ok: true, dados: { enviadoPara: destino } }
}

export async function desativarEnvioEmail(): Promise<Resultado> {
  await exigirSessao()
  try {
    await prisma.configuracaoEmail.update({ where: { id: 'unica' }, data: { ativo: false } })
    revalidarTelas('/configuracoes', '/solicitacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao desativar.' }
  }
}
