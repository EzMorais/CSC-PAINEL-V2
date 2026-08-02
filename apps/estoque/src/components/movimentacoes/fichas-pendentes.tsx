'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { sincronizarFicha } from '@/actions/movimentacoes'
import { dataBR } from '@/lib/dominio/formato'

export type FichaPendente = {
  id: string
  funcionarioNome: string | null
  materialNome: string
  quantidade: number
  unidade: string
  ocorridoEm: Date
  erroSincronizacao: string | null
}

/**
 * Fichas de EPI que saíram do estoque mas ainda não chegaram ao RH.
 *
 * Fica no topo da tela de propósito. Uma ficha faltando é um documento que a fiscalização
 * cobra da empresa — escondê-la num relatório que ninguém abre seria o mesmo que não ter
 * registrado o problema.
 */
export function FichasPendentes({ fichas }: { fichas: FichaPendente[] }) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (fichas.length === 0) return null

  function reenviarTodas() {
    setErro(null)
    iniciar(async () => {
      const falhas: string[] = []
      for (const f of fichas) {
        const r = await sincronizarFicha(f.id)
        if (!r.ok) falhas.push(r.erro)
      }
      // Uma mensagem só: se o RH está fora do ar, as dez fichas falham pelo mesmo motivo, e
      // dez linhas idênticas na tela não ajudam ninguém.
      if (falhas.length > 0) setErro(falhas[0])
    })
  }

  return (
    <section
      data-testid="fichas-pendentes"
      className="rounded-lg border border-status-atencao/40 bg-status-atencao/10 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-atencao" />
          <div>
            <h2 className="text-sm font-medium">
              {fichas.length} ficha{fichas.length === 1 ? '' : 's'} de EPI não chegou ao RH
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              O material saiu do estoque normalmente. Falta só o registro no RH — o documento
              que a NR-6 exige.
            </p>
          </div>
        </div>
        <button
          type="button" onClick={reenviarTodas} disabled={pendente} data-testid="reenviar-fichas"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${pendente ? 'animate-spin' : ''}`} />
          {pendente ? 'Reenviando…' : 'Reenviar agora'}
        </button>
      </div>

      <ul className="mt-3 space-y-1 text-xs">
        {fichas.map((f) => (
          <li key={f.id} className="flex flex-wrap justify-between gap-2 border-b border-border/40 pb-1 last:border-0">
            <span>
              {f.funcionarioNome ?? 'funcionário não identificado'} · {f.materialNome}{' '}
              <span className="tabular">({f.quantidade} {f.unidade})</span>
            </span>
            <span className="tabular text-muted-foreground">{dataBR(f.ocorridoEm)}</span>
          </li>
        ))}
      </ul>

      {(erro || fichas[0]?.erroSincronizacao) && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Último erro: {erro ?? fichas[0]?.erroSincronizacao}
        </p>
      )}
    </section>
  )
}
