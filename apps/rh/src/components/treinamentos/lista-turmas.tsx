'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { NORMA_TREINAMENTO, ROTULO_NORMA_TREINAMENTO, type NormaTreinamento } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import type { TurmaListada } from '@/queries/treinamentos'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function ListaTurmas({ linhas }: { linhas: TurmaListada[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')

  const normaAtual = params.get('norma') ?? ''

  function aplicar(novos: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    router.push(`/treinamentos${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => { e.preventDefault(); aplicar({ busca }) }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Descrição da turma"
              aria-label="Buscar turma"
              data-testid="busca-turma"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
        </form>

        <select
          value={normaAtual}
          onChange={(e) => aplicar({ norma: e.target.value })}
          aria-label="Filtrar por norma"
          className={`${CAMPO} w-auto`}
        >
          <option value="">Todas as normas</option>
          {Object.values(NORMA_TREINAMENTO).map((n: NormaTreinamento) => (
            <option key={n} value={n}>{ROTULO_NORMA_TREINAMENTO[n]}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="contagem-turmas">
        {linhas.length} turma{linhas.length === 1 ? '' : 's'}
      </p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma turma registrada.
        </p>
      ) : (
        <ul data-testid="lista-turmas" className="space-y-2">
          {linhas.map((t) => (
            <li key={t.id}>
              <Link
                href={`/treinamentos/${t.id}`}
                className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">{t.descricao}</span>
                  <span className="text-xs tabular text-muted-foreground">{dataBR(t.realizadoEm)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ROTULO_NORMA_TREINAMENTO[t.norma as NormaTreinamento] ?? t.norma}
                  {t.instrutor && <> · Instrutor: {t.instrutor}</>}
                  {t.cargaHoraria && <> · {t.cargaHoraria}h</>}
                  {' · '}{t._count.participantes} participante{t._count.participantes === 1 ? '' : 's'}
                  {t.validadeEm && <> · válido até {dataBR(t.validadeEm)}</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
