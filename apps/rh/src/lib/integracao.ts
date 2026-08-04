import 'server-only'
import { SignJWT, jwtVerify } from 'jose'

/**
 * Autenticação entre os módulos — sistema falando com sistema, não pessoa.
 *
 * Reaproveita o AUTH_SECRET que os módulos já precisam compartilhar para o login valer nos
 * dois. Não é preguiça: qualquer segredo novo seria mais uma variável para alguém esquecer
 * de copiar no computador novo, e o modo de falhar seria "a integração parou e ninguém
 * sabe por quê", meses depois. Se o AUTH_SECRET estiver errado, o login já não funciona —
 * o erro aparece no primeiro minuto, não no primeiro EPI entregue.
 *
 * O token é de vida curta e traz quem chamou. Não substitui a sessão do usuário: ele diz
 * "este pedido veio do Almoxarifado", não "este pedido é do fulano".
 */
const EMISSOR_VALIDO = ['estoque', 'rh', 'painel-locacao', 'alojamentos', 'portal', 'programacao'] as const
export type ModuloEmissor = (typeof EMISSOR_VALIDO)[number]

const VALIDADE_SEGUNDOS = 60

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

/** Assina um token para chamar outro módulo. Vida curta: ele viaja em rede local, mas um token eterno vazado seria eterno. */
export async function assinarTokenIntegracao(origem: ModuloEmissor): Promise<string> {
  return new SignJWT({ origem, tipo: 'integracao' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${VALIDADE_SEGUNDOS}s`)
    .sign(segredo())
}

export type OrigemChamada = { origem: ModuloEmissor }

/**
 * Confere o token de quem está chamando. Devolve null em qualquer problema — assinatura
 * inválida, expirado, ou um token de SESSÃO tentando passar por token de integração.
 *
 * A checagem de `tipo` importa: sem ela, o cookie de sessão de qualquer usuário logado
 * serviria como credencial de máquina, e um endereço pensado para o almoxarifado passaria a
 * aceitar chamada de qualquer pessoa com uma conta.
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
