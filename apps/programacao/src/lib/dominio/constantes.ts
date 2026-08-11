/** Estado da programação do dia. */
export const STATUS_PROGRAMACAO = {
  RASCUNHO: 'RASCUNHO',
  PUBLICADA: 'PUBLICADA',
} as const

export type StatusProgramacao = (typeof STATUS_PROGRAMACAO)[keyof typeof STATUS_PROGRAMACAO]

export const ROTULO_STATUS: Record<StatusProgramacao, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADA: 'Publicada',
}

export const TIPO_RECURSO = {
  VEICULO: 'VEICULO',
  MAQUINA: 'MAQUINA',
  AVISO: 'AVISO',
} as const

export type TipoRecurso = (typeof TIPO_RECURSO)[keyof typeof TIPO_RECURSO]

export const ROTULO_TIPO_RECURSO: Record<TipoRecurso, string> = {
  VEICULO: 'Veículo',
  MAQUINA: 'Máquina',
  AVISO: 'Aviso',
}

/**
 * As cores dos cabeçalhos, as mesmas do Excel de hoje.
 *
 * A turma acha a própria coluna pela cor antes de ler o nome — trocar a paleta faria a
 * imagem parecer de outra empresa no primeiro dia.
 */
export const CORES_FRENTE = [
  { nome: 'Rosa', valor: '#F4A9A0' },
  { nome: 'Coral', valor: '#F28B82' },
  { nome: 'Salmão', valor: '#E9967A' },
  { nome: 'Pêssego', valor: '#FCE4D6' },
  { nome: 'Laranja claro', valor: '#F4B183' },
  { nome: 'Laranja', valor: '#ED7D31' },
  { nome: 'Âmbar', valor: '#F6B26B' },
  { nome: 'Dourado', valor: '#FFD966' },
  { nome: 'Amarelo claro', valor: '#FFF2CC' },
  { nome: 'Ocre', valor: '#C9A227' },
  { nome: 'Terracota', valor: '#C65D3A' },
  { nome: 'Vermelho claro', valor: '#F4CCCC' },
  { nome: 'Vermelho pastel', valor: '#E6B8B7' },
  { nome: 'Vinho claro', valor: '#D99694' },
  { nome: 'Rosa antigo', valor: '#C97C78' },
  { nome: 'Rosa queimado', valor: '#A64D4D' },
  { nome: 'Lilás quente', valor: '#D9A6A6' },
  { nome: 'Areia', valor: '#EAD7B7' },
  { nome: 'Bege', valor: '#F3E5AB' },
  { nome: 'Creme', valor: '#FFF8E7' },
  { nome: 'Cinza quente', valor: '#D9D2C3' },
  { nome: 'Cinza claro', valor: '#F2F2F2' },
  { nome: 'Cinza médio', valor: '#BFBFBF' },
]

/**
 * Cor de cada grupo de função — pinta o crachá do funcionário no quadro e a linha dele na
 * imagem enviada pro grupo. Vermelho é gestão/técnica/liderança, azul é apoio operacional,
 * amarelo é alvenaria/construção civil, roxo é instalações/acabamento, laranja é
 * montagem/estrutura metálica, cinza é operação de equipamento, verde é motorista/frota.
 */
export const CORES_FUNCAO = [
  { nome: 'Vermelho', valor: '#8B0000' },
  { nome: 'Azul', valor: '#1B4F91' },
  { nome: 'Amarelo', valor: '#C9A227' },
  { nome: 'Roxo', valor: '#6A3FA0' },
  { nome: 'Laranja', valor: '#C1560C' },
  { nome: 'Cinza', valor: '#55606B' },
  { nome: 'Verde', valor: '#1B6B34' },
  { nome: 'Azul petróleo', valor: '#0F6B78' },
  { nome: 'Azul médio', valor: '#2F75B5' },
  { nome: 'Verde esmeralda', valor: '#217346' },
  { nome: 'Turquesa', valor: '#168C8C' },
  { nome: 'Vinho', valor: '#7F1D3A' },
  { nome: 'Magenta', valor: '#A61C7C' },
  { nome: 'Marrom', valor: '#7F6000' },
  { nome: 'Grafite', valor: '#374151' },
  { nome: 'Índigo', valor: '#4338CA' },
]

/**
 * Preto ou branco, o que for mais legível sobre a cor dada.
 *
 * Fórmula de luminância relativa padrão (WCAG), não meia-força: um vermelho escuro (#8B0000)
 * e um amarelo (#C9A227) pedem texto de cor oposta, e advinhar por "é uma cor clara?" erra
 * feio nos tons médios que a paleta usa.
 */
export function corTextoPara(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminancia > 0.55 ? '#000000' : '#FFFFFF'
}

/** Meia-noite UTC de uma data de calendário — mesma convenção dos outros módulos. */
export function diaUtc(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()))
}

export function hojeUtc(): Date {
  return diaUtc(new Date())
}

/** A data que a programação de amanhã usa — é sempre um dia à frente que o chefe lança. */
export function amanhaUtc(): Date {
  const h = hojeUtc()
  return new Date(h.getTime() + 24 * 60 * 60 * 1000)
}

const DIAS = [
  'DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA',
  'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO',
]

/** "SEXTA-FEIRA 31/07/26" — o título exato que a imagem de hoje traz. */
export function tituloDoDia(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  const ano = String(data.getUTCFullYear()).slice(-2)
  return `${DIAS[data.getUTCDay()]} ${dia}/${mes}/${ano}`
}

/** yyyy-mm-dd, para navegar entre dias pela barra de endereço. */
export function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function deIso(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim())
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}
