'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { PECA_UNIFORME, ROTULO_PECA_UNIFORME, ROTULO_MOTIVO_ENTREGA_UNIFORME, type MotivoEntregaUniforme, type PecaUniforme } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import type { EntregaListada } from '@/queries/uniformes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Assinatura({ src }: { src: string | null }) {
  if (!src) return <span className="text-xs text-muted-foreground">—</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URI local, não há o que o next/image otimizar
    <img src={src} alt="Assinatura de recebimento" className="h-8 w-16 rounded border border-border bg-white object-contain" />
  )
}

export function ListaEntregas({ linhas }: { linhas: EntregaListada[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')

  const pecaAtual = params.get('peca') ?? ''

  function aplicar(novos: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    router.push(`/uniformes${p.toString() ? `?${p}` : ''}`)
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
              placeholder="Nome ou matrícula"
              aria-label="Buscar entrega"
              data-testid="busca-entrega"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
        </form>

        <select
          value={pecaAtual}
          onChange={(e) => aplicar({ peca: e.target.value })}
          aria-label="Filtrar por peça"
          className={`${CAMPO} w-auto`}
        >
          <option value="">Todas as peças</option>
          {Object.values(PECA_UNIFORME).map((p: PecaUniforme) => (
            <option key={p} value={p}>{ROTULO_PECA_UNIFORME[p]}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="contagem-entregas">
        {linhas.length} entrega{linhas.length === 1 ? '' : 's'}
      </p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma entrega registrada.
        </p>
      ) : (
        <>
          <ul data-testid="lista-cards-entregas" className="space-y-2 lg:hidden">
            {linhas.map((e) => (
              <li key={e.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{e.funcionario.nome}</span>
                  <Assinatura src={e.assinatura} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="tabular">{e.funcionario.matricula}</span> · {ROTULO_PECA_UNIFORME[e.peca as PecaUniforme] ?? e.peca} {e.tamanho} × {e.quantidade}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ROTULO_MOTIVO_ENTREGA_UNIFORME[e.motivo as MotivoEntregaUniforme] ?? e.motivo} · {dataBR(e.entregueEm)}
                </p>
              </li>
            ))}
          </ul>

          <div data-testid="tabela-entregas" className="hidden overflow-x-auto rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Funcionário</th>
                  <th className="px-3 py-2 font-medium">Peça</th>
                  <th className="px-3 py-2 font-medium">Tamanho</th>
                  <th className="px-3 py-2 font-medium">Qtd.</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Registrado por</th>
                  <th className="px-3 py-2 font-medium">Assinatura</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="font-medium">{e.funcionario.nome}</span>
                      <span className="block text-xs tabular text-muted-foreground">{e.funcionario.matricula}</span>
                    </td>
                    <td className="px-3 py-2">{ROTULO_PECA_UNIFORME[e.peca as PecaUniforme] ?? e.peca}</td>
                    <td className="px-3 py-2 tabular">{e.tamanho}</td>
                    <td className="px-3 py-2 tabular">{e.quantidade}</td>
                    <td className="px-3 py-2">{ROTULO_MOTIVO_ENTREGA_UNIFORME[e.motivo as MotivoEntregaUniforme] ?? e.motivo}</td>
                    <td className="px-3 py-2 tabular">{dataBR(e.entregueEm)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.registradoPor ?? '—'}</td>
                    <td className="px-3 py-2"><Assinatura src={e.assinatura} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
