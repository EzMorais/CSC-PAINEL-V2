/** Situação do funcionário. Campo gravado, não derivado — ver comentário no schema. */
export const STATUS = {
  ATIVO: 'ATIVO',
  AFASTADO: 'AFASTADO',
  FERIAS: 'FERIAS',
  DESLIGADO: 'DESLIGADO',
} as const

export type Status = (typeof STATUS)[keyof typeof STATUS]

export const ROTULO_STATUS: Record<Status, string> = {
  ATIVO: 'Ativo',
  AFASTADO: 'Afastado',
  FERIAS: 'Férias',
  DESLIGADO: 'Desligado',
}

/** Reaproveita os tons de status já definidos em globals.css, para não inventar cor nova. */
export const TOM_STATUS: Record<Status, 'ativa' | 'atencao' | 'vencida' | 'devolvida'> = {
  ATIVO: 'ativa',
  AFASTADO: 'atencao',
  FERIAS: 'atencao',
  DESLIGADO: 'devolvida',
}

/** Tipos de evento da timeline. O valor gravado é a chave; o rótulo é só exibição. */
export const EVENTO = {
  ADMISSAO: 'ADMISSAO',
  MUDANCA_CARGO: 'MUDANCA_CARGO',
  MUDANCA_OBRA: 'MUDANCA_OBRA',
  AFASTAMENTO: 'AFASTAMENTO',
  RETORNO: 'RETORNO',
  FERIAS: 'FERIAS',
  ADVERTENCIA: 'ADVERTENCIA',
  PROMOCAO: 'PROMOCAO',
  DESLIGAMENTO: 'DESLIGAMENTO',
  OBSERVACAO: 'OBSERVACAO',
} as const

export type TipoEvento = (typeof EVENTO)[keyof typeof EVENTO]

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  ADMISSAO: 'Admissão',
  MUDANCA_CARGO: 'Mudança de cargo',
  MUDANCA_OBRA: 'Mudança de obra',
  AFASTAMENTO: 'Afastamento',
  RETORNO: 'Retorno',
  FERIAS: 'Férias',
  ADVERTENCIA: 'Advertência',
  PROMOCAO: 'Promoção',
  DESLIGAMENTO: 'Desligamento',
  OBSERVACAO: 'Observação',
}

export const TIPO_CONTRATO = ['CLT', 'PJ', 'TEMPORARIO', 'APRENDIZ'] as const
export const PARENTESCO = ['FILHO', 'CONJUGE', 'OUTRO'] as const
export const RISCO_CARGO = ['NORMAL', 'INSALUBRE', 'PERICULOSO'] as const
