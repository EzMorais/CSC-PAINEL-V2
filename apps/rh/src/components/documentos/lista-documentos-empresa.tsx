'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { CATEGORIA_DOCUMENTO_EMPRESA, ROTULO_CATEGORIA_DOCUMENTO_EMPRESA, type CategoriaDocumentoEmpresa } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import type { DocumentoEmpresaListado } from '@/queries/documentos'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function ListaDocumentosEmpresa({ linhas }: { linhas: DocumentoEmpresaListado[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')
  const categoriaAtual = params.get('categoria') ?? ''
  const hoje = new Date()

  function aplicar(novos: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    router.push(`/documentos${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); aplicar({ busca }) }}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Título do documento" aria-label="Buscar documento"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
        </form>
        <select value={categoriaAtual} onChange={(e) => aplicar({ categoria: e.target.value })} aria-label="Filtrar por categoria" className={`${CAMPO} w-auto`}>
          <option value="">Todas as categorias</option>
          {Object.values(CATEGORIA_DOCUMENTO_EMPRESA).map((c: CategoriaDocumentoEmpresa) => (
            <option key={c} value={c}>{ROTULO_CATEGORIA_DOCUMENTO_EMPRESA[c]}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-muted-foreground">{linhas.length} documento{linhas.length === 1 ? '' : 's'}</p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum documento registrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {linhas.map((d) => {
            const vencido = d.validoAte ? d.validoAte < hoje : false
            return (
              <li key={d.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-medium">{d.titulo}</span>
                    <span className="ml-2 text-xs text-muted-foreground">v{d.versao}</span>
                  </div>
                  {d.arquivo && (
                    <a href={d.arquivo} download={`${d.categoria}-v${d.versao}`} className="text-xs text-primary hover:underline">Ver arquivo</a>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ROTULO_CATEGORIA_DOCUMENTO_EMPRESA[d.categoria as CategoriaDocumentoEmpresa] ?? d.categoria}
                  {d.obra && <> · {d.obra.codigo}</>}
                  {d.validoAte && (
                    <span className={vencido ? 'text-destructive' : undefined}> · {vencido ? 'venceu em' : 'válido até'} {dataBR(d.validoAte)}</span>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
