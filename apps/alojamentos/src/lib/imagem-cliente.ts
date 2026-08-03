/**
 * Reduz uma imagem no navegador antes de virar texto para o banco.
 *
 * A foto aparece em listagem e ficha — ou seja, é lida o tempo todo,
 * ao contrário de um documento anexado, que alguém abre uma vez por ano. Uma foto de celular
 * tem vários megabytes; guardada inteira, cada consulta de lista carregaria tudo isso por
 * pessoa. Reduzir aqui, no cliente, é o único ponto onde dá para fazer isso sem servidor de
 * imagem — que este projeto não tem.
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
