/**
 * Reduz uma imagem no navegador antes de virar texto para o banco.
 *
 * A foto do funcionário/veículo aparece em listagem e no card do quadro — ou seja, é lida o
 * tempo todo. Uma foto de celular tem vários megabytes; guardada inteira, cada consulta de
 * lista carregaria tudo isso por pessoa. Reduzir aqui, no cliente, é o único ponto onde dá
 * para fazer isso sem servidor de imagem — que este projeto não tem.
 *
 * JPEG de propósito: PNG guardaria a foto sem perda e sem ganho nenhum de qualidade
 * percebida, com um arquivo várias vezes maior.
 */
export async function fotoParaDataUri(arquivo: File, maxLado = 480, qualidade = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(arquivo)

  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('O navegador não conseguiu processar a imagem.')
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', qualidade)
}

const EXTENSOES_IMAGEM = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tif', 'tiff', 'avif', 'ico'])

/**
 * Lê uma logo preservando transparência e proporção. O navegador otimiza os formatos que
 * consegue decodificar; SVG/TIFF e outros seguem como data URI original para o servidor
 * tratar na gravação.
 */
export async function logoParaDataUri(arquivo: File, maxLado = 640, qualidade = 0.9): Promise<string> {
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? ''
  if (!arquivo.type.startsWith('image/') && !EXTENSOES_IMAGEM.has(extensao)) {
    throw new Error('Escolha um arquivo de imagem válido.')
  }
  if (arquivo.size > 12 * 1024 * 1024) {
    throw new Error('A logo deve ter no máximo 12 MB.')
  }

  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const largura = Math.max(1, Math.round(bitmap.width * escala))
    const altura = Math.max(1, Math.round(bitmap.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('O navegador não conseguiu processar a logo.')
    ctx.clearRect(0, 0, largura, altura)
    ctx.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()
    return canvas.toDataURL('image/webp', qualidade)
  } catch {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader()
      leitor.onload = () => resolve(String(leitor.result))
      leitor.onerror = () => reject(new Error('Não foi possível ler a logo.'))
      leitor.readAsDataURL(arquivo)
    })
  }
}
