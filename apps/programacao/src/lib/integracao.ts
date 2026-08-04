import 'server-only'
import { SignJWT } from 'jose'

/**
 * Autenticação entre os módulos — sistema falando com sistema, não pessoa.
 *
 * Reaproveita o AUTH_SECRET que todos compartilham. Se ele estiver errado, o login já não
 * funciona — o erro aparece no primeiro minuto, não semanas depois numa integração calada.
 *
 * Este módulo só ASSINA: consulta o RH (pessoas), a Frota (veículos) e o Portal (máquinas),
 * e ninguém o consulta de volta.
 */
const VALIDADE_SEGUNDOS = 60

function segredo() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou curto demais. Todos os módulos precisam do MESMO valor — ' +
        'é ele que faz o login do Portal valer aqui e autentica a integração.',
    )
  }
  return new TextEncoder().encode(s)
}

export async function assinarTokenIntegracao(): Promise<string> {
  return new SignJWT({ origem: 'programacao', tipo: 'integracao' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${VALIDADE_SEGUNDOS}s`)
    .sign(segredo())
}
