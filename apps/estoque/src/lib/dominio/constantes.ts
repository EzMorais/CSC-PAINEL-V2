/**
 * Tipos de movimentação do almoxarifado.
 *
 * Cada tipo tem UMA direção fixa, definida em `SINAL_MOVIMENTACAO`. A quantidade gravada é
 * sempre positiva — quem decide se soma ou subtrai é o tipo, nunca o número. Por isso
 * "ajuste" é dois tipos e não um: um ajuste de inventário que pudesse ser positivo ou
 * negativo com o mesmo tipo obrigaria a guardar o sinal dentro da quantidade, e aí uma
 * saída digitada como positiva somaria em vez de subtrair, sem nada denunciando o erro.
 */
export const MOVIMENTACAO = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  DEVOLUCAO: 'DEVOLUCAO',
  PERDA: 'PERDA',
  AJUSTE_POSITIVO: 'AJUSTE_POSITIVO',
  AJUSTE_NEGATIVO: 'AJUSTE_NEGATIVO',
} as const

export type TipoMovimentacao = (typeof MOVIMENTACAO)[keyof typeof MOVIMENTACAO]

export const ROTULO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  ENTRADA: 'Entrada (compra)',
  SAIDA: 'Saída para obra',
  DEVOLUCAO: 'Devolução de obra',
  PERDA: 'Perda ou quebra',
  AJUSTE_POSITIVO: 'Ajuste de inventário (sobra)',
  AJUSTE_NEGATIVO: 'Ajuste de inventário (falta)',
}

/** +1 soma no saldo, -1 subtrai. É esta tabela que define o saldo — mudá-la reescreve a história. */
export const SINAL_MOVIMENTACAO: Record<TipoMovimentacao, 1 | -1> = {
  ENTRADA: 1,
  DEVOLUCAO: 1,
  AJUSTE_POSITIVO: 1,
  SAIDA: -1,
  PERDA: -1,
  AJUSTE_NEGATIVO: -1,
}

/** Reaproveita os tons já definidos em globals.css, para não inventar cor nova. */
export const TOM_MOVIMENTACAO: Record<TipoMovimentacao, 'ativa' | 'atencao' | 'vencida' | 'devolvida'> = {
  ENTRADA: 'ativa',
  DEVOLUCAO: 'ativa',
  AJUSTE_POSITIVO: 'devolvida',
  SAIDA: 'atencao',
  PERDA: 'vencida',
  AJUSTE_NEGATIVO: 'devolvida',
}

/** Movimentações que exigem informar a obra de destino. */
export const EXIGE_OBRA: TipoMovimentacao[] = [MOVIMENTACAO.SAIDA, MOVIMENTACAO.DEVOLUCAO]

/** Só a entrada tem preço: o material já foi pago quando entrou. */
export const EXIGE_FORNECEDOR: TipoMovimentacao[] = [MOVIMENTACAO.ENTRADA]

export const CATEGORIA_MATERIAL = {
  CIMENTO_ARGAMASSA: 'CIMENTO_ARGAMASSA',
  AGREGADO: 'AGREGADO',
  ACO_FERRAGEM: 'ACO_FERRAGEM',
  MADEIRA: 'MADEIRA',
  ELETRICA: 'ELETRICA',
  HIDRAULICA: 'HIDRAULICA',
  PINTURA: 'PINTURA',
  IMPERMEABILIZACAO: 'IMPERMEABILIZACAO',
  EPI: 'EPI',
  FERRAMENTA: 'FERRAMENTA',
  CONSUMIVEL: 'CONSUMIVEL',
  OUTRO: 'OUTRO',
} as const

export type CategoriaMaterial = (typeof CATEGORIA_MATERIAL)[keyof typeof CATEGORIA_MATERIAL]

export const ROTULO_CATEGORIA_MATERIAL: Record<CategoriaMaterial, string> = {
  CIMENTO_ARGAMASSA: 'Cimento e argamassa',
  AGREGADO: 'Agregados (areia, brita)',
  ACO_FERRAGEM: 'Aço e ferragem',
  MADEIRA: 'Madeira e formas',
  ELETRICA: 'Elétrica',
  HIDRAULICA: 'Hidráulica',
  PINTURA: 'Pintura',
  IMPERMEABILIZACAO: 'Impermeabilização',
  EPI: 'EPI',
  FERRAMENTA: 'Ferramentas',
  CONSUMIVEL: 'Consumíveis',
  OUTRO: 'Outro',
}

/**
 * Unidades de medida. A chave é o que aparece na tela — são siglas que o almoxarife já
 * usa na nota fiscal, então traduzir para nome completo só atrapalharia a conferência.
 */
export const UNIDADE = ['UN', 'CX', 'PC', 'PAR', 'KG', 'SC', 'M', 'M2', 'M3', 'L', 'RL'] as const

export type Unidade = (typeof UNIDADE)[number]

/** Situação do saldo de um material. Calculada, nunca gravada — ver comentário no schema. */
export const SITUACAO_SALDO = {
  ZERADO: 'ZERADO',
  ABAIXO: 'ABAIXO',
  OK: 'OK',
} as const

export type SituacaoSaldo = (typeof SITUACAO_SALDO)[keyof typeof SITUACAO_SALDO]

export const ROTULO_SITUACAO_SALDO: Record<SituacaoSaldo, string> = {
  ZERADO: 'Sem estoque',
  ABAIXO: 'Abaixo do mínimo',
  OK: 'Normal',
}

export const TOM_SITUACAO_SALDO: Record<SituacaoSaldo, 'ativa' | 'atencao' | 'vencida'> = {
  ZERADO: 'vencida',
  ABAIXO: 'atencao',
  OK: 'ativa',
}

/**
 * A situação de um material a partir do saldo e do mínimo cadastrado.
 *
 * Mínimo zero significa "não controlo reposição deste item" — nesse caso só o saldo
 * zerado é digno de alerta, senão todo item sem mínimo definido viveria em "abaixo do
 * mínimo" e o alerta perderia o sentido por excesso de ruído.
 */
export function situacaoDoSaldo(saldo: number, estoqueMinimo: number): SituacaoSaldo {
  if (saldo <= 0) return SITUACAO_SALDO.ZERADO
  if (estoqueMinimo > 0 && saldo < estoqueMinimo) return SITUACAO_SALDO.ABAIXO
  return SITUACAO_SALDO.OK
}
