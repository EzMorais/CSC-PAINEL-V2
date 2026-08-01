import { DIAS_ATENCAO, STATUS, type StatusLocacao } from './constantes'

export type EntradaStatus = {
  dataFim: Date | null
  devolvidaEm: Date | null
}

const DIA_MS = 86_400_000

/**
 * Número do dia calendário de uma data ARMAZENADA (Excel, banco).
 *
 * Essas datas são gravadas como meia-noite UTC representando um dia de calendário:
 * `2026-08-08T00:00:00Z` significa "8 de agosto", não um instante. Ler seus componentes
 * em horário local as jogaria para o dia anterior no Brasil (UTC−3), que é exatamente o
 * bug que fazia a tela exibir "08/08/2026 — vence em 7 dias" quando faltavam 8.
 */
function diaArmazenado(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DIA_MS
}

/**
 * Número do dia calendário de AGORA, no fuso de quem está olhando a tela.
 *
 * Aqui os componentes locais são os certos: "hoje" para quem está no canteiro é o dia
 * do relógio dele, não o dia em UTC.
 */
function diaDeHoje(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DIA_MS
}

/** Dias até o fim da locação. Negativo = vencida há N dias. null = sem prazo. */
export function diasRestantes(dataFim: Date | null, hoje: Date = new Date()): number | null {
  if (!dataFim) return null
  return diaArmazenado(dataFim) - diaDeHoje(hoje)
}

/**
 * Limites de data para filtrar por status em SQL, no mesmo referencial UTC-meia-noite
 * em que `dataFim` está gravada. Use isto em vez de `startOfDay` ao montar cláusulas
 * Prisma, senão o filtro discorda da etiqueta exibida na tabela.
 */
export function limiteEmDias(dias: number, hoje: Date = new Date()): Date {
  return new Date((diaDeHoje(hoje) + dias) * DIA_MS)
}

export function calcularStatus(entrada: EntradaStatus, hoje: Date = new Date()): StatusLocacao {
  if (entrada.devolvidaEm) return STATUS.DEVOLVIDA
  const dias = diasRestantes(entrada.dataFim, hoje)
  if (dias === null) return STATUS.SEM_PRAZO
  if (dias < 0) return STATUS.VENCIDA
  if (dias <= DIAS_ATENCAO) return STATUS.ATENCAO
  return STATUS.ATIVA
}

/** Texto curto para a coluna de vencimento, ex.: "vence em 3 dias", "vencida há 12 dias". */
export function rotuloVencimento(dataFim: Date | null, hoje: Date = new Date()): string {
  const dias = diasRestantes(dataFim, hoje)
  if (dias === null) return 'sem prazo'
  if (dias < 0) return `vencida há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
  if (dias === 0) return 'vence hoje'
  return `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}
