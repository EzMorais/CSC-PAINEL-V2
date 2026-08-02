export const TIPO_APROVACAO = {
  AJUSTE_INVENTARIO: 'AJUSTE_INVENTARIO',
  PERDA: 'PERDA',
  SOLICITACAO_COMPRA: 'SOLICITACAO_COMPRA',
} as const

export type TipoAprovacao = (typeof TIPO_APROVACAO)[keyof typeof TIPO_APROVACAO]

export const ROTULO_TIPO_APROVACAO: Record<TipoAprovacao, string> = {
  AJUSTE_INVENTARIO: 'Ajuste de inventário',
  PERDA: 'Perda ou quebra',
  SOLICITACAO_COMPRA: 'Solicitação de compra',
}

/** Por que cada um dos três precisa de autorização — aparece na tela de quem aprova. */
export const MOTIVO_DA_REGRA: Record<TipoAprovacao, string> = {
  AJUSTE_INVENTARIO:
    'Ajuste some com estoque sem contrapartida: é a forma mais silenciosa de um furo virar número certo no sistema.',
  PERDA:
    'Baixa por perda tira material do saldo sem nada entrando em troca — merece um segundo par de olhos.',
  SOLICITACAO_COMPRA:
    'Acima do limite configurado, o pedido compromete dinheiro e vai direto ao fornecedor.',
}

export const STATUS_APROVACAO = {
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  REJEITADA: 'REJEITADA',
} as const

export type StatusAprovacao = (typeof STATUS_APROVACAO)[keyof typeof STATUS_APROVACAO]

export const ROTULO_STATUS_APROVACAO: Record<StatusAprovacao, string> = {
  PENDENTE: 'Aguardando aprovação',
  APROVADA: 'Aprovada',
  REJEITADA: 'Recusada',
}

export const TOM_STATUS_APROVACAO: Record<StatusAprovacao, 'ativa' | 'atencao' | 'vencida'> = {
  PENDENTE: 'atencao',
  APROVADA: 'ativa',
  REJEITADA: 'vencida',
}
