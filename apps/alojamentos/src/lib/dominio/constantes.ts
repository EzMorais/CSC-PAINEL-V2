export const STATUS_ALOCACAO = { ATIVA: 'ATIVA', ENCERRADA: 'ENCERRADA' } as const
export type StatusAlocacao = (typeof STATUS_ALOCACAO)[keyof typeof STATUS_ALOCACAO]

export const ROTULO_STATUS_ALOCACAO: Record<StatusAlocacao, string> = {
  ATIVA: 'Morando',
  ENCERRADA: 'Saiu',
}

export const TOM_STATUS_ALOCACAO: Record<StatusAlocacao, 'ativa' | 'devolvida'> = {
  ATIVA: 'ativa',
  ENCERRADA: 'devolvida',
}

export const TIPO_QUARTO = { MASCULINO: 'MASCULINO', FEMININO: 'FEMININO', MISTO: 'MISTO' } as const
export type TipoQuarto = (typeof TIPO_QUARTO)[keyof typeof TIPO_QUARTO]

export const ROTULO_TIPO_QUARTO: Record<TipoQuarto, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  MISTO: 'Misto',
}

/**
 * Como a pessoa vai do alojamento até a obra.
 *
 * Carona e ônibus fretado não são detalhe: são o transporte real do canteiro, e é o que a
 * empresa precisa saber para remanejar alguém sem deixar a pessoa sem como chegar.
 */
export const TIPO_TRANSPORTE = { PROPRIO: 'PROPRIO', CARONA: 'CARONA', ONIBUS: 'ONIBUS' } as const
export type TipoTransporte = (typeof TIPO_TRANSPORTE)[keyof typeof TIPO_TRANSPORTE]

export const ROTULO_TIPO_TRANSPORTE: Record<TipoTransporte, string> = {
  PROPRIO: 'Por conta própria',
  CARONA: 'Carona',
  ONIBUS: 'Ônibus fretado',
}

export const TIPO_PEDIDO = { LIMPEZA: 'LIMPEZA', MANUTENCAO: 'MANUTENCAO', PESSOAL: 'PESSOAL' } as const
export type TipoPedido = (typeof TIPO_PEDIDO)[keyof typeof TIPO_PEDIDO]

export const ROTULO_TIPO_PEDIDO: Record<TipoPedido, string> = {
  LIMPEZA: 'Material de limpeza',
  MANUTENCAO: 'Manutenção',
  PESSOAL: 'Pedido pessoal',
}

export const STATUS_PEDIDO = {
  ABERTO: 'ABERTO',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  ATENDIDO: 'ATENDIDO',
  CANCELADO: 'CANCELADO',
} as const
export type StatusPedido = (typeof STATUS_PEDIDO)[keyof typeof STATUS_PEDIDO]

export const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  ATENDIDO: 'Atendido',
  CANCELADO: 'Cancelado',
}

export const TOM_STATUS_PEDIDO: Record<StatusPedido, 'ativa' | 'atencao' | 'vencida' | 'devolvida'> = {
  ABERTO: 'atencao',
  EM_ANDAMENTO: 'atencao',
  ATENDIDO: 'ativa',
  CANCELADO: 'devolvida',
}

export const PRIORIDADE_PEDIDO = { BAIXA: 'BAIXA', NORMAL: 'NORMAL', ALTA: 'ALTA' } as const
export type PrioridadePedido = (typeof PRIORIDADE_PEDIDO)[keyof typeof PRIORIDADE_PEDIDO]

export const ROTULO_PRIORIDADE_PEDIDO: Record<PrioridadePedido, string> = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
}

export const TIPO_PROGRAMACAO = {
  ONIBUS: 'ONIBUS',
  LIMPEZA: 'LIMPEZA',
  REFEICAO: 'REFEICAO',
  MANUTENCAO: 'MANUTENCAO',
  AVISO: 'AVISO',
} as const
export type TipoProgramacao = (typeof TIPO_PROGRAMACAO)[keyof typeof TIPO_PROGRAMACAO]

export const ROTULO_TIPO_PROGRAMACAO: Record<TipoProgramacao, string> = {
  ONIBUS: 'Ônibus',
  LIMPEZA: 'Limpeza',
  REFEICAO: 'Refeição',
  MANUTENCAO: 'Manutenção',
  AVISO: 'Aviso',
}

/**
 * A escada da obra, copiada do RH.
 *
 * Cópia e não importação porque são apps separados, com bancos separados: o nível chega
 * aqui dentro da resposta da API do RH, e este módulo só precisa saber como escrever cada
 * um por extenso. Quem manda na definição é `apps/rh/src/lib/dominio/constantes.ts`.
 */
export const ROTULO_NIVEL_OBRA: Record<string, string> = {
  GERENTE_DE_OBRAS: 'Gerente de obras',
  ENGENHEIRO: 'Engenheiro(a)',
  MESTRE_DE_OBRAS: 'Mestre de obras',
  ENCARREGADO: 'Encarregado(a)',
  OFICIAL: 'Oficial',
  MEIO_OFICIAL: 'Meio-oficial',
  SERVENTE_AJUDANTE: 'Servente / Ajudante',
}
