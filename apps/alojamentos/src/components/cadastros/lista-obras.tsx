'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, MapPin } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { criarObra, alternarAtivaObra } from '@/actions/cadastros'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type ObraListada = {
  id: string
  codigo: string
  cliente: string
  descricao: string
  endereco: string | null
  cidade: string | null
  uf: string | null
  temCoordenada: boolean
  ativa: boolean
}

function Linha({ obra }: { obra: ObraListada }) {
  const [ativa, setAtiva] = useState(obra.ativa)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 ${!ativa ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          <span className="tabular">{obra.codigo}</span> — {obra.descricao}
        </p>
        <p className="text-xs text-muted-foreground">{obra.cliente}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {[obra.endereco, obra.cidade, obra.uf].filter(Boolean).join(', ') || 'sem endereço'}
          {obra.temCoordenada && <span className="text-status-ativa">· no mapa</span>}
        </p>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>

      <label className="inline-flex shrink-0 items-center gap-2 text-sm">
        <input
          type="checkbox" checked={ativa} disabled={pendente}
          onChange={(e) => {
            const proximo = e.target.checked
            setAtiva(proximo)
            setErro(null)
            iniciar(async () => {
              const r = await chamarAction(alternarAtivaObra(obra.id, proximo))
              if (!r.ok) { setErro(r.erro); setAtiva(!proximo) }
            })
          }}
        />
        {ativa ? 'Ativa' : 'Inativa'}
      </label>
    </li>
  )
}

export function ListaObras({ obras }: { obras: ObraListada[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(criarObra(Object.fromEntries(fd.entries())))
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
      form.reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Obras</h2>
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
            <input name="codigo" placeholder="Código (igual ao dos outros sistemas)" required autoFocus className={CAMPO} />
            <input name="cliente" placeholder="Cliente" required className={CAMPO} />
            <input name="descricao" placeholder="Descrição da obra" required className={CAMPO} />
            <input name="endereco" placeholder="Endereço (rua e número)" className={CAMPO} />
            <input name="cidade" placeholder="Cidade" className={CAMPO} />
            <input name="uf" placeholder="UF" maxLength={2} className={CAMPO} />
          </div>
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
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma obra cadastrada aqui ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm shadow-sm" data-testid="lista-obras">
          {obras.map((o) => <Linha key={o.id} obra={o} />)}
        </ul>
      )}
    </div>
  )
}
