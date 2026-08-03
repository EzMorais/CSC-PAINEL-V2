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
  { nome: 'Azul', valor: '#4EA6DC' },
  { nome: 'Azul claro', valor: '#9DC3E6' },
  { nome: 'Laranja', valor: '#F4B183' },
  { nome: 'Amarelo', valor: '#FFFF00' },
  { nome: 'Cinza', valor: '#D9D9D9' },
  { nome: 'Verde', valor: '#A9D08E' },
  { nome: 'Roxo', valor: '#C9A0DC' },
]

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
