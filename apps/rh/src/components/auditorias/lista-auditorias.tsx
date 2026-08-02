'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { dataBR } from '@/lib/dominio/formato'
import type { AuditoriaListada } from '@/queries/auditorias'

export function ListaAuditorias({ linhas }: { linhas: AuditoriaListada[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')

  return (
    <div className="space-y-4">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const p = new URLSearchParams(params.toString())
          if (busca) p.set('busca', busca)
          else p.delete('busca')
          router.push(`/auditorias${p.toString() ? `?${p}` : ''}`)
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Título da auditoria" aria-label="Buscar auditoria"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
      </form>

      <p className="text-sm text-muted-foreground">{linhas.length} auditoria{linhas.length === 1 ? '' : 's'}</p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma auditoria registrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {linhas.map((a) => (
            <li key={a.id}>
              <Link href={`/auditorias/${a.id}`} className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">{a.titulo}</span>
                  <span className="text-xs tabular text-muted-foreground">{dataBR(a.realizadaEm)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.norma && <>{a.norma} · </>}
                  {a.obra && <>{a.obra.codigo} · </>}
                  {a._count.itens} item{a._count.itens === 1 ? '' : 'ns'}
                  {a.responsavel && <> · {a.responsavel}</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
