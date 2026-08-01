'use client'

import { useState, useTransition } from 'react'
import { reclassificarEmLote } from '@/actions/locacoes'

type Props = {
  ids: string[]
  obras: { id: string; codigo: string; cliente: string }[]
  aoLimpar: () => void
  aoConcluir: () => void
}

/**
 * Barra que resolve o passivo dos 110 itens com "obra a confirmar": eles vieram de abas
 * compartilhadas por mais de uma obra na planilha, e reclassificar em lote é a única forma
 * prática de fechar essa conta sem abrir item por item.
 */
export function AcoesLote({ ids, obras, aoLimpar, aoConcluir }: Props) {
  const [destino, setDestino] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function mover() {
    setErro(null)
    iniciar(async () => {
      const r = await reclassificarEmLote(ids, destino)
      if (!r.ok) return setErro(r.erro)
      aoConcluir()
    })
  }

  return (
    <div data-testid="acoes-lote"
         className="sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <span className="text-sm font-medium">
        {ids.length} selecionado{ids.length > 1 ? 's' : ''}
      </span>

      <select aria-label="Mover para a obra" value={destino} onChange={(e) => setDestino(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
        <option value="">Mover para a obra...</option>
        {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente} · {o.codigo}</option>)}
      </select>

      <button type="button" onClick={mover} disabled={!destino || pendente}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {pendente ? 'Movendo...' : 'Mover'}
      </button>

      <button type="button" onClick={aoLimpar} className="text-sm text-muted-foreground hover:text-foreground">
        Limpar seleção
      </button>

      {erro && <span role="alert" className="text-sm text-destructive">{erro}</span>}
    </div>
  )
}
