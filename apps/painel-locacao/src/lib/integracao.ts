import 'server-only'
import { jwtVerify } from 'jose'

/**
 * Autenticação entre os módulos — sistema falando com sistema, não pessoa.
 *
 * Reaproveita o AUTH_SECRET que os módulos já precisam compartilhar para o login valer nos
 * dois. Se ele estiver errado, o login já não funciona — o erro aparece no primeiro minuto,
 * não semanas depois numa integração silenciosa.
 *
 * Este módulo só VERIFICA: o Painel de Locação é consultado pelo Portal, não consulta
 * ninguém. Quando precisar chamar outro módulo, entra aqui um `assinarTokenIntegracao`
 * igual ao do Almoxarifado.
 */
const EMISSOR_VALIDO = ['estoque', 'rh', 'painel-locacao', 'alojamentos', 'portal'] as const
export type ModuloEmissor = (typeof EMISSOR_VALIDO)[number]

function segredo() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou curto demais. Os módulos precisam do MESMO valor para a ' +
        'integração e o login compartilhado funcionarem.',
    )
  }
  return new TextEncoder().encode(s)
}

export type OrigemChamada = { origem: ModuloEmissor }

/**
 * Confere o token de quem está chamando. Devolve null em qualquer problema — assinatura
 * inválida, expirado, ou um token de SESSÃO tentando passar por token de integração.
 *
 * A checagem de `tipo` importa: sem ela, o cookie de sessão de qualquer usuário logado
 * serviria como credencial de máquina.
 */
export async function verificarTokenIntegracao(authorization: string | null): Promise<OrigemChamada | null> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, segredo())
    if (payload.tipo !== 'integracao') return null
    const origem = String(payload.origem) as ModuloEmissor
    if (!EMISSOR_VALIDO.includes(origem)) return null
    return { origem }
  } catch {
    return null
  }
}
