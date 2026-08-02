'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { SeloMovimentacao } from '@/components/selo'
import { MOVIMENTACAO, ROTULO_MOVIMENTACAO, SINAL_MOVIMENTACAO, type TipoMovimentacao } from '@/lib/dominio/constantes'
import { brl, dataBR } from '@/lib/dominio/formato'
import type { MovimentacaoListada, ObraListada } from '@/queries/movimentacoes'

const CAMPO =
  'rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function ListaMovimentacoes({ linhas, obras }: { linhas: MovimentacaoListada[]; obras: ObraListada[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')

  const tipoAtual = params.get('tipo') ?? ''
  const obraAtual = params.get('obraId') ?? ''

  function aplicar(novos: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    router.push(`/movimentacoes${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); aplicar({ busca }) }}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Material, código ou documento" aria-label="Buscar movimentação" data-testid="busca"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
        </form>

        <select value={tipoAtual} onChange={(e) => aplicar({ tipo: e.target.value })} aria-label="Filtrar por tipo" className={CAMPO}>
          <option value="">Todos os tipos</option>
          {Object.values(MOVIMENTACAO).map((t: TipoMovimentacao) => (
            <option key={t} value={t}>{ROTULO_MOVIMENTACAO[t]}</option>
          ))}
        </select>

        <select value={obraAtual} onChange={(e) => aplicar({ obraId: e.target.value })} aria-label="Filtrar por obra" className={CAMPO}>
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo}</option>)}
        </select>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="contagem">
        {linhas.length} {linhas.length === 1 ? 'movimentação' : 'movimentações'}
      </p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma movimentação registrada.
        </p>
      ) : (
        <>
          <ul data-testid="lista-cards" className="space-y-2 lg:hidden">
            {linhas.map((m) => {
              const sinal = SINAL_MOVIMENTACAO[m.tipo as TipoMovimentacao] ?? 0
              return (
                <li key={m.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{m.material.nome}</span>
                    <SeloMovimentacao tipo={m.tipo} />
                  </div>
                  <p className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className={`tabular font-medium ${sinal > 0 ? 'text-status-ativa' : 'text-status-atencao'}`}>
                      {sinal > 0 ? '+' : '−'}{m.quantidade} {m.material.unidade}
                    </span>
                    <span className="text-xs tabular text-muted-foreground">{dataBR(m.ocorridoEm)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="tabular">{m.material.codigo}</span>
                    {m.obra && <> · Obra {m.obra.codigo}</>}
                    {m.fornecedor && <> · {m.fornecedor.nome}</>}
                  </p>
                </li>
              )
            })}
          </ul>

          <div data-testid="tabela-movimentacoes" className="hidden overflow-x-auto rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Material</th>
                  <th className="px-3 py-2 text-right font-medium">Quantidade</th>
                  <th className="px-3 py-2 font-medium">Obra / Fornecedor</th>
                  <th className="px-3 py-2 text-right font-medium">Preço un.</th>
                  <th className="px-3 py-2 font-medium">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((m) => {
                  const sinal = SINAL_MOVIMENTACAO[m.tipo as TipoMovimentacao] ?? 0
                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 tabular">{dataBR(m.ocorridoEm)}</td>
                      <td className="px-3 py-2"><SeloMovimentacao tipo={m.tipo} /></td>
                      <td className="px-3 py-2">
                        <Link href={`/materiais/${m.materialId}`} className="font-medium hover:underline">
                          {m.material.nome}
                        </Link>
                        <span className="block text-xs tabular text-muted-foreground">{m.material.codigo}</span>
                      </td>
                      <td className={`px-3 py-2 text-right tabular font-medium ${sinal > 0 ? 'text-status-ativa' : 'text-status-atencao'}`}>
                        {sinal > 0 ? '+' : '−'}{m.quantidade} {m.material.unidade}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {m.obra?.codigo ?? m.fornecedor?.nome ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular text-muted-foreground">
                        {m.valorUnitario != null ? brl(m.valorUnitario) : '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{m.registradoPor ?? '—'}</td>
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
