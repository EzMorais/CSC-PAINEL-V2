'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { alternarAtivaObra, criarObra } from '@/actions/cadastros'
import { brl } from '@/lib/dominio/formato'
import type { ObraListada } from '@/queries/movimentacoes'
import type { ConsumoObra } from '@/queries/dashboard'

const CAMPO =
  'rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

function LinhaObra({ obra, consumo }: { obra: ObraListada; consumo?: ConsumoObra }) {
  const [ativa, setAtiva] = useState(obra.ativa)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 ${!ativa ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          <span className="tabular">{obra.codigo}</span> <span className="text-muted-foreground">— {obra.descricao}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {obra.cliente}
          {obra.responsavel && <> · resp. {obra.responsavel}</>}
        </p>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>

      {consumo && (
        <p className="shrink-0 text-right text-xs text-muted-foreground">
          <span className="block tabular">{consumo.itens} itens</span>
          <span className="block tabular">{brl(consumo.valor)}</span>
        </p>
      )}

      <label className="inline-flex shrink-0 items-center gap-2 text-sm">
        <input
          type="checkbox" checked={ativa} disabled={pendente}
          onChange={(e) => {
            const proxima = e.target.checked
            setAtiva(proxima)
            setErro(null)
            iniciar(async () => {
              const r = await alternarAtivaObra(obra.id, proxima)
              if (!r.ok) { setErro(r.erro); setAtiva(!proxima) }
            })
          }}
        />
        {ativa ? 'Ativa' : 'Inativa'}
      </label>
    </li>
  )
}

export function ListaObras({ obras, consumos }: { obras: ObraListada[]; consumos: ConsumoObra[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const consumoPorCodigo = new Map(consumos.map((c) => [c.codigo, c]))

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setErro(null)
    iniciar(async () => {
      const r = await criarObra(Object.fromEntries(fd.entries()))
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
      form.reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Obras atendidas</h2>
        {!criando && (
          <button
            type="button" onClick={() => setCriando(true)} data-testid="nova-obra"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Nova obra
          </button>
        )}
      </div>

      {criando && (
        <form onSubmit={aoSubmeter} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="codigo" placeholder="Código (o mesmo do Painel de Locação)" required autoFocus className={CAMPO} />
            <input name="cliente" placeholder="Cliente" required className={CAMPO} />
            <input name="descricao" placeholder="Descrição da obra" required className={CAMPO} />
            <input name="responsavel" placeholder="Responsável" className={CAMPO} />
          </div>
          <p className="text-xs text-muted-foreground">
            Use exatamente o mesmo código da obra no Painel de Locação — é por ele que os dois
            sistemas vão se reconhecer.
          </p>
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-obra"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Criando…' : 'Criar obra'}
            </button>
            <button type="button" onClick={() => { setCriando(false); setErro(null) }} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {obras.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma obra cadastrada. Cadastre uma antes de lançar saídas de material.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm" data-testid="lista-obras">
          {obras.map((o) => <LinhaObra key={o.id} obra={o} consumo={consumoPorCodigo.get(o.codigo)} />)}
        </ul>
      )}
    </div>
  )
}
