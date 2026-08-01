import { ESTADO, type EstadoItem } from '../dominio/constantes'

export type Coluna15 = {
  quantidade: number | null
  estado: EstadoItem | null
  observacoes: string | null
}

const VAZIO: Coluna15 = { quantidade: null, estado: null, observacoes: null }

/** Textos que são cabeçalho repetido ou lixo estrutural, não dado. */
const IGNORAR = /^(unidades|observa[çc][õo]es|obs)$/i

export function classificarColuna15(bruto: unknown): Coluna15 {
  if (bruto === null || bruto === undefined) return VAZIO
  const texto = String(bruto).trim()
  if (!texto) return VAZIO
  if (IGNORAR.test(texto)) return VAZIO

  // Número puro → quantidade. Aceita "8", "8.0", "8,0".
  if (/^\d+([.,]\d+)?$/.test(texto)) {
    const n = Math.round(Number(texto.replace(',', '.')))
    return { ...VAZIO, quantidade: n > 0 ? n : null }
  }

  if (/^perdid[oa]s?$/i.test(texto)) return { ...VAZIO, estado: ESTADO.PERDIDO }
  if (/^ok$/i.test(texto)) return { ...VAZIO, estado: ESTADO.OK }
  if (/^danificad[oa]s?$/i.test(texto)) return { ...VAZIO, estado: ESTADO.DANIFICADO }

  return { ...VAZIO, observacoes: texto }
}
