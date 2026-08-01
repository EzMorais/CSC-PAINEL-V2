import { differenceInCalendarDays } from 'date-fns'

export type NomePeriodo = 'Diário' | 'Semanal' | 'Quinzenal' | 'Mensal'

/** Coluna J da planilha: classifica a duração em nome de período. */
export function periodoPorDias(dias: number): NomePeriodo {
  if (dias <= 1) return 'Diário'
  if (dias <= 7) return 'Semanal'
  if (dias <= 15) return 'Quinzenal'
  return 'Mensal'
}

/** Coluna K: quantos períodos cabem na duração, arredondando para cima. */
export function quantidadePeriodos(dias: number): number {
  const periodo = periodoPorDias(dias)
  if (periodo === 'Diário') return dias
  const divisor = periodo === 'Semanal' ? 7 : periodo === 'Quinzenal' ? 15 : 30
  return Math.ceil(dias / divisor)
}

export function duracaoEmDias(inicio: Date | null, fim: Date | null): number {
  if (!inicio || !fim) return 0
  return differenceInCalendarDays(fim, inicio)
}

/** Coluna M: valor do item multiplicado pela quantidade de períodos. */
export function valorTotal(valorItem: number | null, inicio: Date | null, fim: Date | null): number {
  if (!valorItem) return 0
  const dias = duracaoEmDias(inicio, fim)
  if (dias <= 0) return valorItem
  return valorItem * quantidadePeriodos(dias)
}
