const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

export function brl(valor: number | null | undefined): string {
  return MOEDA.format(valor ?? 0)
}

/**
 * Formata uma data ARMAZENADA (banco, Excel), gravada como meia-noite UTC representando
 * um dia de calendário. Para carimbar um instante real — "emitido em", "gerado às" —
 * use `dataLocalBR`, senão o dia adianta após as 21h no horário de Brasília.
 */
export function dataBR(data: Date | null | undefined): string {
  if (!data) return '—'
  return DATA.format(data)
}

const DATA_LOCAL = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Formata um INSTANTE real no fuso de quem gerou (ex.: carimbo de emissão de relatório). */
export function dataLocalBR(data: Date = new Date()): string {
  return DATA_LOCAL.format(data)
}

/** Aceita "31/07/2026" ou "2026-07-31". Retorna null se não reconhecer. */
export function parseDataBR(texto: string): Date | null {
  const t = texto.trim()
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (br) return new Date(Date.UTC(+br[3], +br[2] - 1, +br[1]))
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]))
  return null
}
