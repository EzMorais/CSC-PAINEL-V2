'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { obterSolicitacao, proximoNumero, sugerirItens } from '@/queries/solicitacoes'
import { STATUS_SOLICITACAO } from '@/lib/dominio/constantes'
import { assuntoDoEmail, corpoDoEmail } from '@/lib/dominio/email-solicitacao'
import { configuracaoEmail, enviarEmail } from '@/lib/email/enviar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const esquemaItem = z.object({
  materialId: z.string().trim().min(1),
  quantidade: z.coerce.number().positive(),
  saldoNaEpoca: z.coerce.number(),
  minimoNaEpoca: z.coerce.number(),
  precoEstimado: z.union([z.coerce.number().nonnegative(), z.literal(''), z.null()]).optional(),
})

const esquema = z.object({
  observacao: opcional,
  itens: z.array(esquemaItem).min(1, 'Selecione ao menos um material.'),
})

export async function criarSolicitacao(entrada: unknown): Promise<Resultado<{ id: string; numero: string }>> {
  const sessao = await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const numero = await proximoNumero()
    const solicitacao = await prisma.solicitacaoCompra.create({
      data: {
        numero,
        observacao: d.observacao ?? null,
        registradoPor: sessao.nome,
        itens: {
          create: d.itens.map((i) => ({
            materialId: i.materialId,
            quantidade: i.quantidade,
            saldoNaEpoca: i.saldoNaEpoca,
            minimoNaEpoca: i.minimoNaEpoca,
            precoEstimado: typeof i.precoEstimado === 'number' ? i.precoEstimado : null,
          })),
        },
      },
    })

    // Dispara o e-mail sozinho, se houver conta vinculada. A solicitação já está gravada:
    // um erro no envio não pode desfazer o pedido, só ficar registrado nele para reenvio.
    await dispararEmailDaSolicitacao(solicitacao.id, null)

    revalidarTelas('/', '/solicitacoes')
    return { ok: true, dados: { id: solicitacao.id, numero: solicitacao.numero } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao criar a solicitação.' }
  }
}

/**
 * Manda o pedido por e-mail e registra o resultado na própria solicitação.
 *
 * `paraForcado` vem preenchido no reenvio manual, quando a pessoa digita outro destinatário
 * na tela; no disparo automático vem nulo e vale o comprador padrão das Configurações.
 *
 * Nunca lança: é chamada logo depois de uma gravação que deu certo, e deixar uma exceção
 * subir daqui faria a criação do pedido parecer que falhou — a pessoa montaria tudo de novo
 * e o fornecedor receberia dois pedidos iguais por causa de uma senha de e-mail vencida.
 */
export async function dispararEmailDaSolicitacao(
  id: string,
  paraForcado: string | null,
): Promise<Resultado<{ enviadoPara: string }>> {
  try {
    const config = await configuracaoEmail()

    // Sem conta vinculada não é erro: o envio automático é opcional, e a tela continua
    // oferecendo os botões de Gmail/Outlook, que funcionam sem configuração nenhuma.
    if (!config || !config.ativo) {
      return { ok: false, erro: 'Nenhuma conta de e-mail vinculada — use os botões do Gmail ou Outlook.' }
    }
    if (!paraForcado && !config.enviarAutomatico) {
      return { ok: false, erro: 'O envio automático está desligado nas Configurações.' }
    }

    const destino = paraForcado?.trim() || config.destinatarioPadrao
    if (!destino) {
      return { ok: false, erro: 'Nenhum destinatário: informe o e-mail do comprador nas Configurações.' }
    }

    const s = await obterSolicitacao(id)
    if (!s) return { ok: false, erro: 'Solicitação não encontrada.' }

    const paraEmail = {
      numero: s.numero,
      criadoEm: s.criadoEm,
      observacao: s.observacao,
      registradoPor: s.registradoPor,
      itens: s.itens.map((i) => ({
        codigo: i.material.codigo,
        nome: i.material.nome,
        unidade: i.material.unidade,
        quantidade: i.quantidade,
        saldoNaEpoca: i.saldoNaEpoca,
        minimoNaEpoca: i.minimoNaEpoca,
        precoEstimado: i.precoEstimado,
      })),
    }

    const envio = await enviarEmail({
      para: destino,
      assunto: assuntoDoEmail(paraEmail),
      corpo: corpoDoEmail(paraEmail),
    })

    await prisma.solicitacaoCompra.update({
      where: { id },
      data: envio.ok
        ? {
            emailEnviadoPara: destino,
            emailEnviadoEm: new Date(),
            emailErro: null,
            // Saiu o e-mail, o pedido deixou de ser rascunho — marcar à mão depois seria
            // pedir à pessoa que confirmasse uma coisa que o próprio sistema acabou de fazer.
            status: STATUS_SOLICITACAO.ENVIADA,
            enviadaEm: new Date(),
          }
        : { emailErro: envio.erro },
    })

    revalidarTelas('/solicitacoes', `/solicitacoes/${id}`)
    return envio.ok ? { ok: true, dados: { enviadoPara: destino } } : { ok: false, erro: envio.erro }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao enviar o e-mail.' }
  }
}

/**
 * Sugestão pronta para a tela abrir já preenchida.
 *
 * É uma action e não um carregamento de página porque o botão "gerar sugestão" precisa
 * responder com o estado do estoque AGORA — abrir a tela de manhã e clicar à tarde tem de
 * pedir o que falta à tarde, não o que faltava de manhã.
 */
export async function gerarSugestao(): Promise<Resultado<Awaited<ReturnType<typeof sugerirItens>>>> {
  await exigirSessao()
  try {
    const itens = await sugerirItens()
    if (itens.length === 0) {
      return { ok: false, erro: 'Nada abaixo do mínimo no momento — não há o que sugerir.' }
    }
    return { ok: true, dados: itens }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao gerar a sugestão.' }
  }
}

/**
 * Muda o status do pedido.
 *
 * Não mexe no saldo de propósito. Marcar como "atendida" registra que o material chegou,
 * mas quem cria estoque continua sendo a movimentação de entrada — lançada com a nota
 * fiscal na mão, com preço e quantidade reais, que quase nunca são exatamente os pedidos.
 */
export async function mudarStatusSolicitacao(id: string, status: string): Promise<Resultado> {
  await exigirSessao()

  const valido = Object.values(STATUS_SOLICITACAO) as string[]
  if (!valido.includes(status)) return { ok: false, erro: 'Status inválido.' }

  try {
    const agora = new Date()
    await prisma.solicitacaoCompra.update({
      where: { id },
      data: {
        status,
        enviadaEm: status === STATUS_SOLICITACAO.ENVIADA ? agora : undefined,
        atendidaEm: status === STATUS_SOLICITACAO.ATENDIDA ? agora : undefined,
      },
    })
    revalidarTelas('/', '/solicitacoes', `/solicitacoes/${id}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao mudar o status.' }
  }
}

export async function excluirSolicitacao(id: string): Promise<Resultado> {
  await exigirSessao()
  try {
    const s = await prisma.solicitacaoCompra.findUnique({ where: { id }, select: { status: true } })
    if (!s) return { ok: false, erro: 'Solicitação não encontrada.' }
    // Só rascunho pode sumir: depois de enviada, o pedido virou documento — se foi um
    // engano, o caminho é cancelar, que deixa rastro de que existiu.
    if (s.status !== STATUS_SOLICITACAO.RASCUNHO) {
      return { ok: false, erro: 'Só rascunho pode ser excluído. Use "cancelar" para encerrar um pedido já enviado.' }
    }
    await prisma.solicitacaoCompra.delete({ where: { id } })
    revalidarTelas('/', '/solicitacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao excluir.' }
  }
}

// Sem reexportar tipos daqui: num arquivo 'use server' o Next transforma TODO export num
// vínculo de runtime, e um tipo não existe em runtime — o módulo quebrava inteiro com
// "StatusSolicitacao is not defined", derrubando a página. O typecheck não pega isso.
// Quem precisa do tipo importa de `@/lib/dominio/constantes`, que é onde ele mora.
