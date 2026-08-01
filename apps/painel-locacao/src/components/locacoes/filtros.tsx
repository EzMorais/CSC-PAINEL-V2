'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { ROTULO_STATUS, STATUS } from '@/lib/dominio/constantes'

type Props = {
  obras: { id: string; codigo: string; cliente: string }[]
  fornecedores: { id: string; nome: string }[]
}

export function Filtros({ obras, fornecedores }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [abertoNoMobile, setAberto] = useState(false)
  const [, iniciar] = useTransition()

  function aplicar(chave: string, valor: string) {
    const novos = new URLSearchParams(params.toString())
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    iniciar(() => router.push(`/locacoes?${novos.toString()}`))
  }

  const ativos = ['busca', 'obraId', 'fornecedorId', 'status', 'estado', 'aConfirmar']
    .filter((c) => params.get(c))

  const classeCampo =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" placeholder="Buscar equipamento, Tr, observação..."
            defaultValue={params.get('busca') ?? ''}
            onChange={(e) => aplicar('busca', e.target.value)}
            aria-label="Buscar locações"
            className={`${classeCampo} pl-9`}
          />
        </div>
        <button
          type="button" onClick={() => setAberto((v) => !v)}
          aria-expanded={abertoNoMobile} aria-label="Filtros"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm lg:hidden"
        >
          <SlidersHorizontal className="size-4" />
          {ativos.length > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
              {ativos.length}
            </span>
          )}
        </button>
      </div>

      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${abertoNoMobile ? '' : 'hidden lg:grid'}`}>
        <select aria-label="Obra" className={classeCampo}
                value={params.get('obraId') ?? ''} onChange={(e) => aplicar('obraId', e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente} · {o.codigo}</option>)}
        </select>

        <select aria-label="Fornecedor" className={classeCampo}
                value={params.get('fornecedorId') ?? ''} onChange={(e) => aplicar('fornecedorId', e.target.value)}>
          <option value="">Todos os fornecedores</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>

        <select aria-label="Situação" className={classeCampo}
                value={params.get('status') ?? ''} onChange={(e) => aplicar('status', e.target.value)}>
          <option value="">Em aberto</option>
          <option value="TODAS">Todas, inclusive devolvidas</option>
          {Object.values(STATUS).map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
        </select>

        <select aria-label="Estado do item" className={classeCampo}
                value={params.get('estado') ?? ''} onChange={(e) => aplicar('estado', e.target.value)}>
          <option value="">Qualquer estado</option>
          <option value="OK">Em ordem</option>
          <option value="PERDIDO">Perdido</option>
          <option value="DANIFICADO">Danificado</option>
        </select>
      </div>

      {ativos.length > 0 && (
        <button type="button" onClick={() => iniciar(() => router.push('/locacoes'))}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <X className="size-3" /> Limpar {ativos.length} filtro{ativos.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
