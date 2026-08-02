import { prisma } from '@/lib/prisma'

/** Marcador que a tela mostra no lugar da senha salva. Precisa bater com o de `actions/configuracao-email.ts`. */
export const SENHA_MASCARADA = '••••••••'

export type ConfiguracaoEmailTela = {
  provedor: string
  host: string
  porta: number
  usuario: string
  /** Sempre o marcador, nunca a senha real. */
  senha: string
  remetente: string
  destinatarioPadrao: string
  copiaPara: string
  enviarAutomatico: boolean
  ativo: boolean
  testadoEm: Date | null
} | null

/**
 * A configuração para preencher a tela — sem a senha.
 *
 * A senha sai daqui trocada por um marcador de propósito. Ela é gravada para o servidor
 * usar, mas devolvê-la ao navegador a colocaria no HTML da página, ao alcance de qualquer
 * extensão instalada e de qualquer print de tela. Quem quiser trocá-la digita a nova.
 */
export async function carregarConfiguracaoEmail(): Promise<ConfiguracaoEmailTela> {
  const c = await prisma.configuracaoEmail.findUnique({ where: { id: 'unica' } })
  if (!c) return null

  return {
    provedor: c.provedor,
    host: c.host,
    porta: c.porta,
    usuario: c.usuario,
    senha: SENHA_MASCARADA,
    remetente: c.remetente ?? '',
    destinatarioPadrao: c.destinatarioPadrao ?? '',
    copiaPara: c.copiaPara ?? '',
    enviarAutomatico: c.enviarAutomatico,
    ativo: c.ativo,
    testadoEm: c.testadoEm,
  }
}
