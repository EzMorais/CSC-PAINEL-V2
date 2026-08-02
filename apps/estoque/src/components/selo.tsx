import {
  ROTULO_SITUACAO_SALDO, TOM_SITUACAO_SALDO,
  ROTULO_MOVIMENTACAO, TOM_MOVIMENTACAO,
  type SituacaoSaldo, type TipoMovimentacao,
} from '@/lib/dominio/constantes'

const COR_TOM: Record<string, string> = {
  ativa: 'bg-status-ativa/15 text-status-ativa',
  atencao: 'bg-status-atencao/15 text-status-atencao',
  vencida: 'bg-status-vencida/15 text-status-vencida',
  devolvida: 'bg-status-devolvida/15 text-status-devolvida',
}

export function SeloSituacao({ situacao }: { situacao: string }) {
  const tom = TOM_SITUACAO_SALDO[situacao as SituacaoSaldo] ?? 'devolvida'
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${COR_TOM[tom]}`}>
      {ROTULO_SITUACAO_SALDO[situacao as SituacaoSaldo] ?? situacao}
    </span>
  )
}

export function SeloMovimentacao({ tipo }: { tipo: string }) {
  const tom = TOM_MOVIMENTACAO[tipo as TipoMovimentacao] ?? 'devolvida'
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${COR_TOM[tom]}`}>
      {ROTULO_MOVIMENTACAO[tipo as TipoMovimentacao] ?? tipo}
    </span>
  )
}
