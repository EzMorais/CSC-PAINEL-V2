import { TIPO_RECURSO } from './dominio/constantes'

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

const LARGURA_COLUNA = 220
const ALTURA_LINHA = 25
const ALTURA_TITULO = 46
const ALTURA_CABECALHO = 52
const MARGEM = 12
const ESPACO_COLUNA = 12
/** Piso de altura, para um dia com pouca gente não sair como uma tira fina. */
const LINHAS_MINIMAS = 6
/** Acima disto a frente abre outra sub-coluna — é o corte que a planilha usa em MORELLI. */
const PESSOAS_POR_COLUNA = 25

export type FrenteImagem = {
  id: string
  nome: string
  cor: string
  logo: string | null
  colunas: number
}

export type EscalaImagem = { frenteId: string; nome: string; funcaoSigla: string | null }

export type RecursoImagem = {
  frenteId: string
  tipo: string
  descricao: string
  placa: string | null
  motoristaNome: string | null
  destaque: boolean
}

export type RodapeImagem = {
  manutencoes: string[]
  ferias: string[]
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

function larguraAproximadaDoTitulo(texto: string, limite: number): number {
  return Math.min(limite, Math.max(48, texto.length * 7.4))
}

function nomeCurto(nome: string): string {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
}

function iniciaisDoCliente(nome: string): string {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || 'C'
}

/** Identificação curta para qualquer veículo na imagem: primeiro nome do modelo + placa. */
export function textoDoVeiculo(nome: string, placa: string | null | undefined): string {
  const placaLimpa = placa?.trim() ?? ''
  const semPlaca = placaLimpa
    ? nome.replace(new RegExp(placaLimpa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
      .replace(/\s*[-–—]\s*$/, '')
      .trim()
    : nome.trim()
  const primeiroNome = semPlaca.split(/\s+/).filter(Boolean)[0] ?? nome.trim().split(/\s+/)[0] ?? ''
  return placaLimpa && placaLimpa !== '-' ? `${primeiroNome} - ${placaLimpa}` : primeiroNome
}

/**
 * O navegador exibe WebP diretamente, mas o SVG convertido pelo sharp precisa de PNG
 * embutido para renderizar a logo com segurança. A conversão acontece só na exportação;
 * o formato otimizado salvo no cadastro continua menor e adequado para a tela.
 */
export async function logoParaSvg(logo: string | null): Promise<string | null> {
  if (!logo) return null
  const separador = logo.indexOf(',')
  if (!logo.startsWith('data:') || separador < 0) return null

  try {
    const conteudo = logo.slice(separador + 1)
    const bruto = logo.slice(0, separador).includes(';base64')
      ? Buffer.from(conteudo, 'base64')
      : Buffer.from(decodeURIComponent(conteudo))
    const { default: sharp } = await import('sharp')
    const png = await sharp(bruto, { animated: false }).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

/** A linha como sai no print: "BRUNO DE MELLO - ENG" — no máximo primeiro e segundo nome. */
function linhaDaPessoa(e: EscalaImagem): string {
  const nome = nomeCurto(e.nome)
  return e.funcaoSigla ? `${nome} - ${e.funcaoSigla}` : nome
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
  rodape: RodapeImagem = { manutencoes: [], ferias: [] },
): { svg: string; largura: number; altura: number } {
  const colunas = montarColunas(frentes, escalas, recursos)

  const maiorLista = Math.max(LINHAS_MINIMAS, ...colunas.map((c) => c.pessoas.length))
  const maisRecursos = Math.max(0, ...colunas.map((c) => c.recursos.length))

  const largura = MARGEM * 2 + colunas.length * (LARGURA_COLUNA + ESPACO_COLUNA) - ESPACO_COLUNA
  const alturaCorpo = maiorLista * ALTURA_LINHA
  const alturaRecursos = maisRecursos > 0 ? maisRecursos * (ALTURA_LINHA + 2) + 8 : 0
  const blocosRodape = [
    { titulo: 'VEÍCULOS EM MANUTENÇÃO', itens: rodape.manutencoes, cor: '#B45309' },
    { titulo: 'FÉRIAS / AUSÊNCIAS', itens: rodape.ferias, cor: '#2563EB' },
  ].filter((bloco) => bloco.itens.length > 0)
  const alturaBase = MARGEM * 2 + ALTURA_TITULO + ALTURA_CABECALHO + alturaCorpo + alturaRecursos + 4
  const alturaRodape = blocosRodape.length > 0
    ? 58 + Math.max(...blocosRodape.map((bloco) => bloco.itens.length * 16))
    : 0
  const altura = alturaBase + alturaRodape

  const partes: string[] = []

  partes.push(`<rect width="${largura}" height="${altura}" fill="#E8EEF5"/>`)

  // Título neutro: mantém a imagem leve e deixa as cores das frentes como orientação visual.
  partes.push(
    `<rect x="${MARGEM}" y="${MARGEM}" width="${largura - MARGEM * 2}" height="${ALTURA_TITULO}" rx="12" ` +
    `fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1"/>`,
    `<text x="${largura / 2}" y="${MARGEM + ALTURA_TITULO / 2 + 6}" text-anchor="middle" ` +
    `font-family="Calibri, Arial, sans-serif" font-size="19" font-weight="bold" fill="#111827">` +
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
        `<rect x="${x}" y="${topoCabecalho}" width="${larguraCabecalho}" height="${ALTURA_CABECALHO}" rx="10" ` +
        `fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1"/>`,
        `<rect x="${x}" y="${topoCabecalho}" width="${larguraCabecalho}" height="5" rx="3" ` +
        `fill="${escapar(coluna.frente.cor)}"/>`,
      )
      if (coluna.frente.logo) {
        const nome = cortar(coluna.frente.nome, Math.max(10, Math.floor((larguraCabecalho - 70) / 7.4)))
        const larguraNome = larguraAproximadaDoTitulo(nome, Math.max(48, larguraCabecalho - 70))
        const larguraGrupo = 48 + 10 + larguraNome
        const inicioGrupo = x + (larguraCabecalho - larguraGrupo) / 2
        partes.push(
          `<image href="${escapar(coluna.frente.logo)}" x="${inicioGrupo}" y="${topoCabecalho + 11}" ` +
          `width="48" height="30" preserveAspectRatio="xMidYMid meet"/>`,
          `<text x="${inicioGrupo + 58}" y="${topoCabecalho + ALTURA_CABECALHO / 2 + 5}" ` +
          `text-anchor="start" font-family="Arial, sans-serif" font-size="14" font-weight="bold" ` +
          `fill="#111827">${escapar(nome)}</text>`,
        )
      } else {
        const nome = cortar(coluna.frente.nome, Math.max(10, Math.floor((larguraCabecalho - 52) / 7.4)))
        const larguraNome = larguraAproximadaDoTitulo(nome, Math.max(48, larguraCabecalho - 52))
        const larguraGrupo = 32 + 10 + larguraNome
        const inicioGrupo = x + (larguraCabecalho - larguraGrupo) / 2
        partes.push(
          `<circle cx="${inicioGrupo + 16}" cy="${topoCabecalho + ALTURA_CABECALHO / 2 + 1}" r="16" fill="${escapar(coluna.frente.cor)}"/>`,
          `<text x="${inicioGrupo + 16}" y="${topoCabecalho + ALTURA_CABECALHO / 2 + 5}" text-anchor="middle" ` +
          `font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#111827">` +
          `${escapar(iniciaisDoCliente(coluna.frente.nome))}</text>`,
          `<text x="${inicioGrupo + 42}" y="${topoCabecalho + ALTURA_CABECALHO / 2 + 5}" ` +
          `text-anchor="start" font-family="Arial, sans-serif" font-size="14" font-weight="bold" ` +
          `fill="#111827">${escapar(nome)}</text>`,
        )
      }
    }

    // Moldura do corpo
    partes.push(
      `<rect x="${x}" y="${topoCorpo}" width="${LARGURA_COLUNA}" height="${maiorLista * ALTURA_LINHA}" rx="10" ` +
      `fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1"/>`,
    )

    coluna.pessoas.forEach((p, j) => {
      const y = topoCorpo + j * ALTURA_LINHA
      const baseTexto = y + ALTURA_LINHA - 5

      // A cor da função vira apenas uma faixa lateral. O texto permanece escuro e o corpo
      // branco, para a imagem continuar legível mesmo com muitos grupos diferentes.
      const cor = p.funcaoSigla ? corPorSigla.get(p.funcaoSigla) : undefined
      partes.push(
        `<rect x="${x + 6}" y="${y + 2}" width="${LARGURA_COLUNA - 12}" height="${ALTURA_LINHA - 4}" rx="6" ` +
        `fill="${j % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}"/>`,
      )
      if (cor) {
        partes.push(`<rect x="${x + 6}" y="${y + 5}" width="4" height="${ALTURA_LINHA - 10}" rx="2" fill="${escapar(cor)}"/>`)
      }

      // Número em uma pílula discreta, sem transformar cada pessoa em uma linha de planilha.
      partes.push(
        `<rect x="${x + 14}" y="${y + 7}" width="20" height="${ALTURA_LINHA - 14}" rx="7" fill="#EEF2F7"/>`,
        `<text x="${x + 24}" y="${baseTexto}" text-anchor="middle" font-family="Arial, sans-serif" ` +
        `font-size="10" font-weight="bold" fill="#64748B">${coluna.numeroInicial + j}</text>`,
        `<text x="${x + 44}" y="${baseTexto}" font-family="Arial, sans-serif" font-size="11.5" ` +
        `fill="#111827">${escapar(cortar(linhaDaPessoa(p), 34))}</text>`,
      )
    })

    // Faixas de veículo/máquina/aviso no pé da coluna
    coluna.recursos.forEach((r, j) => {
      const y = topoCorpo + maiorLista * ALTURA_LINHA + 6 + j * (ALTURA_LINHA + 2)
      const fundo = r.destaque ? '#FEF3C7' : r.tipo === TIPO_RECURSO.AVISO ? '#FFFFFF' : '#F8FAFC'
      const identificacao = r.tipo === TIPO_RECURSO.VEICULO
        ? textoDoVeiculo(r.descricao, r.placa)
        : r.descricao
      const texto = r.motoristaNome ? `${identificacao} · ${r.motoristaNome}` : identificacao

      partes.push(
        `<rect x="${x + 6}" y="${y}" width="${LARGURA_COLUNA - 12}" height="${ALTURA_LINHA}" rx="7" ` +
        `fill="${fundo}" stroke="#E5E7EB" stroke-width="1"/>`,
        `<text x="${x + 14}" y="${y + ALTURA_LINHA - 7}" text-anchor="start" ` +
        `font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" fill="#111827">` +
        `${escapar(cortar(texto, 36))}</text>`,
      )
    })
  })

  if (blocosRodape.length > 0) {
    const topoRodape = alturaBase
    const gap = 8
    const larguraDisponivel = Math.max(120, largura - MARGEM * 2)
    const larguraBloco = (larguraDisponivel - gap * (blocosRodape.length - 1)) / blocosRodape.length

    partes.push(`<line x1="${MARGEM}" y1="${topoRodape}" x2="${largura - MARGEM}" y2="${topoRodape}" stroke="#D1D5DB" stroke-width="1"/>`)

    blocosRodape.forEach((bloco, indice) => {
      const x = MARGEM + indice * (larguraBloco + gap)
      const y = topoRodape + 8
      const alturaBloco = alturaRodape - 16
      const maximo = Math.max(12, Math.floor((larguraBloco - 24) / 6.2))

      partes.push(
        `<rect x="${x}" y="${y}" width="${larguraBloco}" height="${alturaBloco}" rx="3" ` +
        `fill="#FFFFFF" stroke="#D1D5DB" stroke-width="1"/>`,
        `<rect x="${x}" y="${y}" width="4" height="${alturaBloco}" rx="2" fill="${bloco.cor}"/>`,
        `<text x="${x + 12}" y="${y + 18}" font-family="Calibri, Arial, sans-serif" font-size="10" ` +
        `font-weight="bold" fill="#374151">${escapar(bloco.titulo)}</text>`,
      )

      bloco.itens.forEach((item, itemIndice) => {
        partes.push(
          `<text x="${x + 12}" y="${y + 36 + itemIndice * 16}" font-family="Calibri, Arial, sans-serif" ` +
          `font-size="10.5" fill="#111827">• ${escapar(cortar(item, maximo))}</text>`,
        )
      })
    })
  }

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
