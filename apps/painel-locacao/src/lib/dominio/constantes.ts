export const STATUS = {
  ATIVA: 'ATIVA',
  ATENCAO: 'ATENCAO',
  VENCIDA: 'VENCIDA',
  DEVOLVIDA: 'DEVOLVIDA',
  SEM_PRAZO: 'SEM_PRAZO',
} as const
export type StatusLocacao = (typeof STATUS)[keyof typeof STATUS]

export const ESTADO = {
  OK: 'OK',
  PERDIDO: 'PERDIDO',
  DANIFICADO: 'DANIFICADO',
} as const
export type EstadoItem = (typeof ESTADO)[keyof typeof ESTADO]

export const MOVIMENTACAO = {
  REGISTRO: 'REGISTRO',
  EDICAO: 'EDICAO',
  RENOVACAO: 'RENOVACAO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  DEVOLUCAO: 'DEVOLUCAO',
  IMPORTACAO: 'IMPORTACAO',
  RECLASSIFICACAO: 'RECLASSIFICACAO',
} as const
export type TipoMovimentacao = (typeof MOVIMENTACAO)[keyof typeof MOVIMENTACAO]

/** Limiar de ATENÇÃO, em dias. Definido pela LEGENDA da planilha de origem. */
export const DIAS_ATENCAO = 7

export const PERIODOS = [
  { rotulo: 'Diário (1 dia)',      dias: 1 },
  { rotulo: 'Semanal (7 dias)',    dias: 7 },
  { rotulo: 'Quinzenal (15 dias)', dias: 15 },
  { rotulo: 'Mensal (30 dias)',    dias: 30 },
  { rotulo: 'Trimestre (90 dias)', dias: 90 },
] as const

export const ROTULO_STATUS: Record<StatusLocacao, string> = {
  ATIVA: 'Ativa',
  ATENCAO: 'Atenção',
  VENCIDA: 'Vencida',
  DEVOLVIDA: 'Devolvida',
  SEM_PRAZO: 'Sem prazo',
}
