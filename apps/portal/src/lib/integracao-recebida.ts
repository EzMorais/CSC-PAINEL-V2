import 'server-only'
import { jwtVerify } from 'jose'

/**
 * Confere o token de quem chama o Portal.
 *
 * Separado de `integracao.ts`, que só assina: o Portal passou a ter os dois papéis quando
 * ganhou o catálogo de Cadastros — ele consulta os outros para o dashboard, e agora é
 * consultado pela Programação.
 */
const EMISSOR_VALIDO = [
  'estoque', 'rh', 'painel-locacao', 'alojamentos', 'portal', 'whatsapp', 'programacao',
] as const

export type ModuloEmissor = (typeof EMISSOR_VALIDO)[number]

function segredo() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou curto demais. Todos os módulos precisam do MESMO valor.',
    )
  }
  return new TextEncoder().encode(s)
}

export async function verificarTokenIntegracao(authorization: string | null): Promise<ModuloEmissor | null> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, segredo())
    // Sem esta checagem, o cookie de sessão de qualquer usuário logado serviria como
    // credencial de máquina.
    if (payload.tipo !== 'integracao') return null
    const origem = String(payload.origem) as ModuloEmissor
    if (!EMISSOR_VALIDO.includes(origem)) return null
    return origem
  } catch {
    return null
  }
}
