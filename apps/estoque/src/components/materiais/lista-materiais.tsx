'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { SeloSituacao } from '@/components/selo'
import {
  CATEGORIA_MATERIAL, ROTULO_CATEGORIA_MATERIAL, SITUACAO_SALDO, ROTULO_SITUACAO_SALDO,
  type CategoriaMaterial, type SituacaoSaldo,
} from '@/lib/dominio/constantes'
import { brl } from '@/lib/dominio/formato'
import type { MaterialComSaldo } from '@/queries/saldos'

const CAMPO =
  'rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function ListaMateriais({ linhas }: { linhas: MaterialComSaldo[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')

  const categoriaAtual = params.get('categoria') ?? ''
  const situacaoAtual = params.get('situacao') ?? ''

  function aplicar(novos: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    router.push(`/materiais${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); aplicar({ busca }) }}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou código" aria-label="Buscar material" data-testid="busca"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
        </form>

        <select
          value={categoriaAtual} onChange={(e) => aplicar({ categoria: e.target.value })}
          aria-label="Filtrar por categoria" className={CAMPO}
        >
          <option value="">Todas as categorias</option>
          {Object.values(CATEGORIA_MATERIAL).map((c: CategoriaMaterial) => (
            <option key={c} value={c}>{ROTULO_CATEGORIA_MATERIAL[c]}</option>
          ))}
        </select>

        <select
          value={situacaoAtual} onChange={(e) => aplicar({ situacao: e.target.value })}
          aria-label="Filtrar por situação" data-testid="filtro-situacao" className={CAMPO}
        >
          <option value="">Todas as situações</option>
          {Object.values(SITUACAO_SALDO).map((s: SituacaoSaldo) => (
            <option key={s} value={s}>{ROTULO_SITUACAO_SALDO[s]}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="contagem">
        {linhas.length} {linhas.length === 1 ? 'material' : 'materiais'}
      </p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum material encontrado.
        </p>
      ) : (
        <>
          {/* Cards no celular e tablet; tabela no desktop. Os dois existem no DOM ao mesmo
              tempo — o CSS decide qual aparece, como nos outros módulos. */}
          <ul data-testid="lista-cards" className="space-y-2 lg:hidden">
            {linhas.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/materiais/${m.id}`}
                  className={`block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent ${!m.ativo ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{m.nome}</span>
                    <SeloSituacao situacao={m.situacao} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="tabular">{m.codigo}</span> · {ROTULO_CATEGORIA_MATERIAL[m.categoria as CategoriaMaterial] ?? m.categoria}
                    {!m.ativo && <> · inativo</>}
                  </p>
                  <p className="text-sm tabular">
                    {m.saldo} {m.unidade}
                    {m.estoqueMinimo > 0 && <span className="text-xs text-muted-foreground"> (mín. {m.estoqueMinimo})</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div data-testid="tabela-materiais" className="hidden overflow-x-auto rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Material</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo</th>
                  <th className="px-3 py-2 text-right font-medium">Mínimo</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((m) => (
                  <tr key={m.id} className={`border-t border-border transition-colors hover:bg-accent ${!m.ativo ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2 tabular">
                      <Link href={`/materiais/${m.id}`} className="hover:underline">{m.codigo}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/materiais/${m.id}`} className="font-medium hover:underline">{m.nome}</Link>
                      {!m.ativo && <span className="ml-2 text-xs text-muted-foreground">inativo</span>}
                      {m.localizacao && <span className="block text-xs text-muted-foreground">{m.localizacao}</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {ROTULO_CATEGORIA_MATERIAL[m.categoria as CategoriaMaterial] ?? m.categoria}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{m.saldo} {m.unidade}</td>
                    <td className="px-3 py-2 text-right tabular text-muted-foreground">
                      {m.estoqueMinimo > 0 ? m.estoqueMinimo : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-muted-foreground">
                      {m.valorEmEstoque != null ? brl(m.valorEmEstoque) : '—'}
                    </td>
                    <td className="px-3 py-2"><SeloSituacao situacao={m.situacao} /></td>
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
