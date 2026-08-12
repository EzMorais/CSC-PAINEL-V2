const basePathConfigurado = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const BASE_PATH = basePathConfigurado === '/' ? '' : basePathConfigurado.replace(/\/$/, '')

/** Acrescenta o prefixo público do módulo a caminhos absolutos da aplicação. */
export function caminhoPublico(caminho: string): string {
  if (!BASE_PATH) return caminho
  if (caminho === BASE_PATH || caminho.startsWith(`${BASE_PATH}/`)) return caminho
  if (caminho === '/') return `${BASE_PATH}/`
  return `${BASE_PATH}${caminho.startsWith('/') ? caminho : `/${caminho}`}`
}
