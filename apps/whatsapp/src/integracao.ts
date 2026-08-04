import { SignJWT, jwtVerify } from 'jose'

/**
 * Autenticação entre os módulos — sistema falando com sistema, não pessoa.
 *
 * Reaproveita o AUTH_SECRET que os módulos já compartilham, igual aos outros. Este serviço
 * assina (para entregar ao Alojamentos o que chegou) e verifica (para só aceitar pedidos de
 * envio vindos do Alojamentos).
 *
 * Verificar importa mais aqui do que nos outros módulos: quem alcança este serviço manda
 * mensagem no WhatsApp da empresa. Sem a conferência, qualquer processo na mesma rede
 * escreveria para os funcionários em nome da construtora.
 */
const EMISSOR_VALIDO = ['estoque', 'rh', 'painel-locacao', 'alojamentos', 'portal', 'whatsapp'] as const
export type ModuloEmissor = (typeof EMISSOR_VALIDO)[number]

const VALIDADE_SEGUNDOS = 60

function segredo() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'AUTH_SECRET ausente ou curto demais. Os módulos precisam do MESMO valor para a ' +
        'integração funcionar.',
    )
  }
  return new TextEncoder().encode(s)
}

export async function assinarTokenIntegracao(): Promise<string> {
  return new SignJWT({ origem: 'whatsapp', tipo: 'integracao' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${VALIDADE_SEGUNDOS}s`)
    .sign(segredo())
}

/**
 * Confere o token de quem está chamando. Null em qualquer problema — assinatura inválida,
 * expirado, ou um token de SESSÃO tentando passar por token de integração.
 */
export async function verificarTokenIntegracao(authorization: string | null): Promise<ModuloEmissor | null> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, segredo())
    if (payload.tipo !== 'integracao') return null
    const origem = String(payload.origem) as ModuloEmissor
    if (!EMISSOR_VALIDO.includes(origem)) return null
    return origem
  } catch {
    return null
  }
}
