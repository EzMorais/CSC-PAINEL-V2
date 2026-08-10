const ORIGENS_LOCAIS = [
  ...Array.from({ length: 8 }, (_, indice) => `http://localhost:${3000 + indice}`),
  'http://localhost:3100',
]

function origensPermitidas() {
  const configuradas = (process.env.NEXT_PUBLIC_ORIGENS_MODULOS ?? '')
    .split(',')
    .map((origem) => origem.trim().replace(/\/$/, ''))
    .filter(Boolean)

  return new Set([...ORIGENS_LOCAIS, ...configuradas])
}

/** Aceita caminhos internos e mÃ³dulos previamente cadastrados, nunca qualquer URL externa. */
export function destinoSeguro(valor: unknown): string {
  const destino = String(valor ?? '')
  if (destino.startsWith('/') && !destino.startsWith('//')) return destino

  try {
    const url = new URL(destino)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !origensPermitidas().has(url.origin)) {
      return '/'
    }
    return `${url.origin}${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
