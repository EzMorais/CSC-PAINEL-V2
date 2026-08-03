import {
  ROTULO_STATUS_PEDIDO, TOM_STATUS_PEDIDO, ROTULO_STATUS_ALOCACAO, TOM_STATUS_ALOCACAO,
  ROTULO_TIPO_PEDIDO, ROTULO_TIPO_TRANSPORTE, ROTULO_TIPO_PROGRAMACAO,
  type StatusPedido, type StatusAlocacao, type TipoPedido, type TipoTransporte, type TipoProgramacao,
} from '@/lib/dominio/constantes'

const COR: Record<string, string> = {
  ativa: 'bg-status-ativa/15 text-status-ativa',
  atencao: 'bg-status-atencao/15 text-status-atencao',
  vencida: 'bg-status-vencida/15 text-status-vencida',
  devolvida: 'bg-status-devolvida/15 text-status-devolvida',
  neutro: 'bg-muted text-muted-foreground',
}

const BASE = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'

export function Selo({ texto, tom = 'neutro' }: { texto: string; tom?: keyof typeof COR }) {
  return <span className={`${BASE} ${COR[tom]}`}>{texto}</span>
}

export function SeloStatusPedido({ status }: { status: string }) {
  const s = status as StatusPedido
  return <Selo texto={ROTULO_STATUS_PEDIDO[s] ?? status} tom={TOM_STATUS_PEDIDO[s] ?? 'neutro'} />
}

export function SeloStatusAlocacao({ status }: { status: string }) {
  const s = status as StatusAlocacao
  return <Selo texto={ROTULO_STATUS_ALOCACAO[s] ?? status} tom={TOM_STATUS_ALOCACAO[s] ?? 'neutro'} />
}

export function SeloTipoPedido({ tipo }: { tipo: string }) {
  return <Selo texto={ROTULO_TIPO_PEDIDO[tipo as TipoPedido] ?? tipo} />
}

export function SeloTransporte({ tipo }: { tipo: string }) {
  return <Selo texto={ROTULO_TIPO_TRANSPORTE[tipo as TipoTransporte] ?? tipo} />
}

export function SeloTipoProgramacao({ tipo }: { tipo: string }) {
  return <Selo texto={ROTULO_TIPO_PROGRAMACAO[tipo as TipoProgramacao] ?? tipo} />
}
