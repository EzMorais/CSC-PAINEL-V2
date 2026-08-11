const PALAVRAS_DE_LIGACAO = new Set(['A', 'AS', 'DA', 'DAS', 'DE', 'DO', 'DOS', 'E', 'EM', 'NA', 'NAS', 'NO', 'NOS', 'PARA'])

/** Abrevia um cargo, nunca o nome da pessoa. Ex.: "Mestre de obras" → "MO". */
export function abreviacaoDoCargo(cargo: string | null | undefined): string | null {
  const palavras = cargo?.trim().split(/\s+/).filter(Boolean) ?? []
  if (palavras.length === 0) return null

  const uteis = palavras.filter((palavra) => !PALAVRAS_DE_LIGACAO.has(palavra.toLocaleUpperCase('pt-BR')))
  const base = uteis.length > 0 ? uteis : palavras
  if (base.length === 1) return base[0].slice(0, 5).toUpperCase()
  return base.map((palavra) => palavra[0]).join('').slice(0, 5).toUpperCase()
}
