import 'server-only'
import { SignJWT } from 'jose'

/**
 * Autenticação entre os módulos — sistema falando com sistema, não pessoa.
 *
 * Reaproveita o AUTH_SECRET que os módulos já compartilham para o login valer em todos. O
 * Portal só ASSINA: ele consulta os outros para montar o dashboard geral, e ninguém o
 * consulta de volta.
 *
 * O token é de vida curta e traz quem chamou. Não substitui a sessão do usuário: ele diz
 * "este pedido veio do Portal", não "este pedido é do fulano". Quem decide se a pessoa pode
 * ver o número é o Portal, antes de chamar.
 */
const VALIDADE_SEGUNDOS = 60

function segredo() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou curto demais. Todos os módulos precisam do MESMO valor — ' +
        'é ele que faz o login do Portal valer nos outros sistemas.',
    )
  }
  return new TextEncoder().encode(s)
}

export async function assinarTokenIntegracao(): Promise<string> {
  return new SignJWT({ origem: 'portal', tipo: 'integracao' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${VALIDADE_SEGUNDOS}s`)
    .sign(segredo())
}
