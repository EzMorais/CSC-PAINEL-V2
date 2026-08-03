'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Bus } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { criarRota, alternarAtivaRota } from '@/actions/cadastros'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type RotaListada = {
  id: string
  nome: string
  motorista: string | null
  veiculo: string | null
  horarioIda: string | null
  horarioVolta: string | null
  capacidade: number | null
  obraCodigo: string | null
  ativo: boolean
  passageiros: number
}

function Linha({ rota }: { rota: RotaListada }) {
  const [ativo, setAtivo] = useState(rota.ativo)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const lotado = rota.capacidade != null && rota.passageiros >= rota.capacidade

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 ${!ativo ? 'opacity-60' : ''}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Bus className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{rota.nome}</p>
        <p className="text-xs text-muted-foreground">
          {rota.passageiros} passageiro{rota.passageiros === 1 ? '' : 's'}
          {rota.capacidade != null && <> de {rota.capacidade}</>}
          {lotado && ativo && <span className="text-status-atencao"> · lotado</span>}
          {rota.obraCodigo && <> · Obra {rota.obraCodigo}</>}
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            rota.motorista && `Motorista: ${rota.motorista}`,
            rota.veiculo,
            rota.horarioIda && `ida ${rota.horarioIda}`,
            rota.horarioVolta && `volta ${rota.horarioVolta}`,
          ].filter(Boolean).join(' · ') || 'sem detalhes cadastrados'}
        </p>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>

      <label className="inline-flex shrink-0 items-center gap-2 text-sm">
        <input
          type="checkbox" checked={ativo} disabled={pendente}
          onChange={(e) => {
            const proximo = e.target.checked
            setAtivo(proximo)
            setErro(null)
            iniciar(async () => {
              const r = await chamarAction(alternarAtivaRota(rota.id, proximo))
              if (!r.ok) { setErro(r.erro); setAtivo(!proximo) }
            })
          }}
        />
        {ativo ? 'Ativa' : 'Inativa'}
      </label>
    </li>
  )
}

export function ListaRotas({ rotas }: { rotas: RotaListada[] }) {
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
      const r = await chamarAction(criarRota(Object.fromEntries(fd.entries())))
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
      form.reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Rotas de ônibus fretado</h2>
        {!criando && (
          <button
            type="button" onClick={() => setCriando(true)} data-testid="nova-rota"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Nova rota
          </button>
        )}
      </div>

      {criando && (
        <form onSubmit={aoSubmeter} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="nome" placeholder="Nome da rota" required autoFocus className={CAMPO} />
            <input name="obraCodigo" placeholder="Código da obra atendida" className={CAMPO} />
            <input name="motorista" placeholder="Motorista" className={CAMPO} />
            <input name="veiculo" placeholder="Veículo / placa" className={CAMPO} />
            <input name="horarioIda" placeholder="Horário de ida" className={CAMPO} />
            <input name="horarioVolta" placeholder="Horário de volta" className={CAMPO} />
            <input name="capacidade" type="number" min={1} placeholder="Lugares" className={CAMPO} />
          </div>
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-rota"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Criando…' : 'Criar rota'}
            </button>
            <button type="button" onClick={() => { setCriando(false); setErro(null) }} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {rotas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma rota cadastrada. Cadastre as rotas para poder dizer, em cada morador, em qual ônibus ele vai.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm shadow-sm" data-testid="lista-rotas">
          {rotas.map((r) => <Linha key={r.id} rota={r} />)}
        </ul>
      )}
    </div>
  )
}
