import { TIPO_RECURSO, corTextoPara } from './dominio/constantes'

/**
 * Desenha a programação do dia como imagem, no formato da planilha que o grupo já conhece.
 *
 * SVG montado à mão, e não captura de tela de uma página: a imagem tem de sair igual toda
 * vez, sem depender de fonte instalada, zoom do navegador ou de subir um navegador sem tela
 * no servidor. O SVG vira PNG com o `sharp`, que já vem com o Next.
 *
 * O layout copia o Excel de propósito — cores dos cabeçalhos, numeração à esquerda, faixa
 * de veículos no pé. Cento e cinquenta pessoas leem esse print todo dia; um formato novo,
 * por melhor que fosse, seria mais uma coisa para explicar na segunda-feira.
 */

const LARGURA_COLUNA = 205
const ALTURA_LINHA = 17
const ALTURA_TITULO = 34
const ALTURA_CABECALHO = 26
const MARGEM = 8
const ESPACO_COLUNA = 4
/** Piso de altura, para um dia com pouca gente não sair como uma tira fina. */
const LINHAS_MINIMAS = 6
/** Acima disto a frente abre outra sub-coluna — é o corte que a planilha usa em MORELLI. */
const PESSOAS_POR_COLUNA = 25

export type FrenteImagem = {
  id: string
  nome: string
  cor: string
  colunas: number
}

export type EscalaImagem = { frenteId: string; nome: string; funcaoSigla: string | null }

export type RecursoImagem = {
  frenteId: string
  tipo: string
  descricao: string
  motoristaNome: string | null
  destaque: boolean
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/**
 * Corta o texto no que cabe na coluna.
 *
 * Por contagem de caracteres, e não por medida real: medir exigiria carregar a fonte e
 * calcular avanço de glifo, e o ganho seria de alguns pixels numa tabela cuja fonte é
 * monoespaçada o bastante. O corte é generoso para não comer sobrenome.
 */
function cortar(texto: string, maximo: number): string {
  const t = texto.trim()
  return t.length <= maximo ? t : `${t.slice(0, maximo - 1)}…`
}

/** A linha como sai no print: "BRUNO DE MELLO - ENG". */
function linhaDaPessoa(e: EscalaImagem): string {
  return e.funcaoSigla ? `${e.nome} - ${e.funcaoSigla}` : e.nome
}

type Coluna = {
  frente: FrenteImagem
  /** Índice da sub-coluna dentro da frente: MORELLI ocupa 0 e 1. */
  indice: number
  /** Quantas sub-colunas a frente abriu DE FATO — o cabeçalho se estende por todas. */
  totalPartes: number
  pessoas: EscalaImagem[]
  /** Número da primeira pessoa, para a numeração continuar entre as sub-colunas. */
  numeroInicial: number
  recursos: RecursoImagem[]
}

/**
 * Reparte as pessoas de cada frente entre as sub-colunas dela.
 *
 * MORELLI tem cinquenta pessoas e duas colunas no print: 1–25 na primeira, 26–50 na segunda.
 * Sem repartir, a imagem teria a altura da maior frente e ficaria ilegível no celular.
 */
function montarColunas(
  frentes: FrenteImagem[], escalas: EscalaImagem[], recursos: RecursoImagem[],
): Coluna[] {
  const colunas: Coluna[] = []

  for (const frente of frentes) {
    const daFrente = escalas.filter((e) => e.frenteId === frente.id)

    // `colunas` da frente é o TETO, não um número fixo: MORELLI pode abrir duas quando tem
    // cinquenta pessoas e uma quando tem dez. Fixo, um dia magro sairia com uma coluna
    // vazia ao lado da cheia, e quem lê procuraria o que não está lá.
    const necessarias = Math.max(1, Math.ceil(daFrente.length / PESSOAS_POR_COLUNA))
    const partes = Math.min(Math.max(1, frente.colunas), necessarias)
    const porParte = Math.max(1, Math.ceil(daFrente.length / partes))

    for (let i = 0; i < partes; i++) {
      colunas.push({
        frente,
        indice: i,
        totalPartes: partes,
        pessoas: daFrente.slice(i * porParte, (i + 1) * porParte),
        numeroInicial: i * porParte + 1,
        // Os veículos ficam no pé da ÚLTIMA sub-coluna da frente, como no print.
        recursos: i === partes - 1 ? recursos.filter((r) => r.frenteId === frente.id) : [],
      })
    }
  }

  return colunas
}

export function montarSvg(
  titulo: string, frentes: FrenteImagem[], escalas: EscalaImagem[], recursos: RecursoImagem[],
  /** Sigla → cor do grupo da função, para pintar a linha de cada pessoa como no card do quadro. */
  corPorSigla: Map<string, string> = new Map(),
): { svg: string; largura: number; altura: number } {
  const colunas = montarColunas(frentes, escalas, recursos)

  const maiorLista = Math.max(LINHAS_MINIMAS, ...colunas.map((c) => c.pessoas.length))
  const maisRecursos = Math.max(0, ...colunas.map((c) => c.recursos.length))

  const largura = MARGEM * 2 + colunas.length * (LARGURA_COLUNA + ESPACO_COLUNA) - ESPACO_COLUNA
  const alturaCorpo = maiorLista * ALTURA_LINHA
  const alturaRecursos = maisRecursos > 0 ? maisRecursos * (ALTURA_LINHA + 2) + 8 : 0
  const altura = MARGEM * 2 + ALTURA_TITULO + ALTURA_CABECALHO + alturaCorpo + alturaRecursos + 4

  const partes: string[] = []

  partes.push(`<rect width="${largura}" height="${altura}" fill="#ffffff"/>`)

  // Faixa do título, verde como na planilha
  partes.push(
    `<rect x="${MARGEM}" y="${MARGEM}" width="${largura - MARGEM * 2}" height="${ALTURA_TITULO}" ` +
    `fill="#00B050" stroke="#000000" stroke-width="1"/>`,
    `<text x="${largura / 2}" y="${MARGEM + ALTURA_TITULO / 2 + 6}" text-anchor="middle" ` +
    `font-family="Calibri, Arial, sans-serif" font-size="19" font-weight="bold" fill="#000000">` +
    `${escapar(titulo)}</text>`,
  )

  const topoCabecalho = MARGEM + ALTURA_TITULO
  const topoCorpo = topoCabecalho + ALTURA_CABECALHO

  colunas.forEach((coluna, i) => {
    const x = MARGEM + i * (LARGURA_COLUNA + ESPACO_COLUNA)

    // Cabeçalho: uma frente com duas sub-colunas tem o nome escrito só uma vez, centralizado
    // sobre as duas — é assim que MORELLI aparece na planilha.
    const ehPrimeira = coluna.indice === 0
    const larguraCabecalho = ehPrimeira
      ? coluna.totalPartes * LARGURA_COLUNA + (coluna.totalPartes - 1) * ESPACO_COLUNA
      : 0

    if (ehPrimeira) {
      partes.push(
        `<rect x="${x}" y="${topoCabecalho}" width="${larguraCabecalho}" height="${ALTURA_CABECALHO}" ` +
        `fill="${escapar(coluna.frente.cor)}" stroke="#000000" stroke-width="1"/>`,
        `<text x="${x + larguraCabecalho / 2}" y="${topoCabecalho + ALTURA_CABECALHO / 2 + 5}" ` +
        `text-anchor="middle" font-family="Calibri, Arial, sans-serif" font-size="14" ` +
        `font-weight="bold" fill="#000000">${escapar(coluna.frente.nome)}</text>`,
      )
    }

    // Moldura do corpo
    partes.push(
      `<rect x="${x}" y="${topoCorpo}" width="${LARGURA_COLUNA}" height="${maiorLista * ALTURA_LINHA}" ` +
      `fill="#ffffff" stroke="#000000" stroke-width="1"/>`,
    )

    coluna.pessoas.forEach((p, j) => {
      const y = topoCorpo + j * ALTURA_LINHA
      const baseTexto = y + ALTURA_LINHA - 5

      // Fundo colorido pelo grupo da função — mesma cor do crachá no quadro. Sem função
      // reconhecida, a linha fica branca (nenhuma faixa desenhada).
      const cor = p.funcaoSigla ? corPorSigla.get(p.funcaoSigla) : undefined
      const corTexto = cor ? corTextoPara(cor) : '#000000'
      if (cor) {
        partes.push(`<rect x="${x}" y="${y}" width="${LARGURA_COLUNA}" height="${ALTURA_LINHA}" fill="${cor}"/>`)
      }

      // Faixinha do número, à esquerda
      partes.push(
        `<line x1="${x + 22}" y1="${y}" x2="${x + 22}" y2="${y + ALTURA_LINHA}" stroke="#BFBFBF" stroke-width="0.5"/>`,
        `<text x="${x + 18}" y="${baseTexto}" text-anchor="end" font-family="Calibri, Arial, sans-serif" ` +
        `font-size="11" font-weight="bold" fill="${corTexto}">${coluna.numeroInicial + j}</text>`,
        `<text x="${x + 26}" y="${baseTexto}" font-family="Calibri, Arial, sans-serif" font-size="11.5" ` +
        `fill="${corTexto}">${escapar(cortar(linhaDaPessoa(p), 34))}</text>`,
      )

      if (j > 0) {
        partes.push(
          `<line x1="${x}" y1="${y}" x2="${x + LARGURA_COLUNA}" y2="${y}" stroke="#D9D9D9" stroke-width="0.5"/>`,
        )
      }
    })

    // Faixas de veículo/máquina/aviso no pé da coluna
    coluna.recursos.forEach((r, j) => {
      const y = topoCorpo + maiorLista * ALTURA_LINHA + 6 + j * (ALTURA_LINHA + 2)
      const fundo = r.destaque ? '#FFFF00' : r.tipo === TIPO_RECURSO.AVISO ? '#FFFFFF' : '#F4B183'
      const texto = r.motoristaNome ? `${r.descricao} - ${r.motoristaNome}` : r.descricao

      partes.push(
        `<rect x="${x}" y="${y}" width="${LARGURA_COLUNA}" height="${ALTURA_LINHA}" ` +
        `fill="${fundo}" stroke="#000000" stroke-width="1"/>`,
        `<text x="${x + LARGURA_COLUNA / 2}" y="${y + ALTURA_LINHA - 5}" text-anchor="middle" ` +
        `font-family="Calibri, Arial, sans-serif" font-size="11" font-weight="bold" fill="#000000">` +
        `${escapar(cortar(texto, 36))}</text>`,
      )
    })
  })

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" ` +
    `viewBox="0 0 ${largura} ${altura}">${partes.join('')}</svg>`

  return { svg, largura, altura }
}

/**
 * SVG → PNG.
 *
 * Em 2× porque o print é lido no celular: no tamanho de tela, "BRUNO DE MELLO - ENG" em
 * corpo 11 fica no limite do legível depois da compressão do WhatsApp.
 */
export async function gerarPng(svg: string): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  return sharp(Buffer.from(svg), { density: 144 })
    .png({ compressionLevel: 9 })
    .toBuffer()
}
