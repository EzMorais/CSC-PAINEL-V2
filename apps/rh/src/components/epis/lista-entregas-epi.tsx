'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { dataBR } from '@/lib/dominio/formato'
import type { EntregaEpiListada } from '@/queries/epis'

export function ListaEntregasEpi({ linhas }: { linhas: EntregaEpiListada[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')
  const hoje = new Date()

  return (
    <div className="space-y-4">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const p = new URLSearchParams(params.toString())
          if (busca) p.set('busca', busca)
          else p.delete('busca')
          router.push(`/epis${p.toString() ? `?${p}` : ''}`)
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Funcionário, matrícula, EPI ou CA" aria-label="Buscar entrega de EPI"
            data-testid="busca-epi"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
      </form>

      <p className="text-sm text-muted-foreground" data-testid="contagem-epis">
        {linhas.length} entrega{linhas.length === 1 ? '' : 's'}
      </p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma entrega de EPI registrada. As entregas chegam aqui sozinhas quando o
          Almoxarifado dá saída num material da categoria EPI.
        </p>
      ) : (
        <>
          <ul data-testid="lista-cards-epi" className="space-y-2 lg:hidden">
            {linhas.map((e) => {
              const caVencido = e.validadeCA ? e.validadeCA < hoje : false
              return (
                <li key={e.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/funcionarios/${e.funcionario.id}`} className="font-medium hover:underline">
                      {e.funcionario.nome}
                    </Link>
                    <span className="shrink-0 text-xs tabular text-muted-foreground">{dataBR(e.entregueEm)}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    {e.materialNome} <span className="tabular text-muted-foreground">({e.quantidade} {e.unidade})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="tabular">{e.funcionario.matricula}</span>
                    {e.ca && (
                      <span className={caVencido ? 'text-destructive' : undefined}> · CA {e.ca}{caVencido ? ' (vencido)' : ''}</span>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>

          <div data-testid="tabela-epis" className="hidden overflow-x-auto rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Funcionário</th>
                  <th className="px-3 py-2 font-medium">EPI</th>
                  <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                  <th className="px-3 py-2 font-medium">CA</th>
                  <th className="px-3 py-2 font-medium">Entregue em</th>
                  <th className="px-3 py-2 font-medium">Entregue por</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((e) => {
                  const caVencido = e.validadeCA ? e.validadeCA < hoje : false
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link href={`/funcionarios/${e.funcionario.id}`} className="font-medium hover:underline">
                          {e.funcionario.nome}
                        </Link>
                        <span className="block text-xs tabular text-muted-foreground">{e.funcionario.matricula}</span>
                      </td>
                      <td className="px-3 py-2">
                        {e.materialNome}
                        <span className="block text-xs tabular text-muted-foreground">{e.materialCodigo}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular">{e.quantidade} {e.unidade}</td>
                      <td className={`px-3 py-2 tabular ${caVencido ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {e.ca ?? '—'}
                        {e.validadeCA && (
                          <span className="block text-xs">
                            {caVencido ? 'venceu' : 'até'} {dataBR(e.validadeCA)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular">{dataBR(e.entregueEm)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.entreguePor ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
