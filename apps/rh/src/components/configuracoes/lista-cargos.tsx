'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { criarCargo, editarCargo } from '@/actions/cargos'
import { RISCO_CARGO } from '@/lib/dominio/constantes'
import type { CargoListado } from '@/queries/cargos'

const CAMPO =
  'rounded-md border border-input bg-background px-2 py-1 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

function LinhaCargo({ cargo }: { cargo: CargoListado }) {
  const [risco, setRisco] = useState(cargo.risco)
  const [ativo, setAtivo] = useState(cargo.ativo)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function salvar(proximoRisco: string, proximoAtivo: boolean) {
    setErro(null)
    iniciar(async () => {
      const r = await editarCargo(cargo.id, { risco: proximoRisco, ativo: proximoAtivo })
      if (!r.ok) setErro(r.erro)
    })
  }

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 ${!ativo ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{cargo.nome}</p>
        <p className="text-xs text-muted-foreground">CBO: {cargo.cbo || '—'}</p>
      </div>
      <select
        value={risco} disabled={pendente} className={CAMPO}
        onChange={(e) => { setRisco(e.target.value); salvar(e.target.value, ativo) }}
      >
        {RISCO_CARGO.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <label className="inline-flex shrink-0 items-center gap-2 text-sm">
        <input
          type="checkbox" checked={ativo} disabled={pendente}
          onChange={(e) => { setAtivo(e.target.checked); salvar(risco, e.target.checked) }}
        />
        {ativo ? 'Ativo' : 'Inativo'}
      </label>
      {erro && <p className="basis-full text-xs text-destructive">{erro}</p>}
    </li>
  )
}

export function ListaCargos({ cargos }: { cargos: CargoListado[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [risco, setRisco] = useState<(typeof RISCO_CARGO)[number]>('NORMAL')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function criar() {
    setErro(null)
    iniciar(async () => {
      const r = await criarCargo({ nome, risco })
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
      setNome('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Cargos</h2>
        {!criando && (
          <button
            type="button" onClick={() => setCriando(true)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Novo cargo
          </button>
        )}
      </div>

      {criando && (
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
          <input
            value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cargo" autoFocus className={CAMPO}
          />
          <select value={risco} onChange={(e) => setRisco(e.target.value as (typeof RISCO_CARGO)[number])} className={CAMPO}>
            {RISCO_CARGO.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            type="button" onClick={criar} disabled={pendente || !nome.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {pendente ? 'Criando…' : 'Criar'}
          </button>
          <button type="button" onClick={() => { setCriando(false); setErro(null) }} className="rounded-md border border-border px-3 py-1.5 text-xs">
            Cancelar
          </button>
          {erro && <p className="basis-full text-xs text-destructive">{erro}</p>}
        </div>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {cargos.map((c) => <LinhaCargo key={c.id} cargo={c} />)}
      </ul>
    </div>
  )
}
