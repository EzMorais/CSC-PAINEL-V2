'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { criarQuarto, alternarAtivoQuarto } from '@/actions/alojamentos'
import { ROTULO_TIPO_QUARTO, TIPO_QUARTO, type TipoQuarto } from '@/lib/dominio/constantes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type QuartoLinha = {
  id: string
  numero: string
  capacidade: number
  tipo: string | null
  ativo: boolean
  ocupados: number
}

function Linha({ quarto }: { quarto: QuartoLinha }) {
  const [ativo, setAtivo] = useState(quarto.ativo)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const lotado = quarto.ocupados >= quarto.capacidade

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 ${!ativo ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Quarto {quarto.numero}</p>
        <p className="text-xs text-muted-foreground">
          {quarto.ocupados} de {quarto.capacidade} {quarto.capacidade === 1 ? 'lugar' : 'lugares'}
          {quarto.tipo && <> · {ROTULO_TIPO_QUARTO[quarto.tipo as TipoQuarto] ?? quarto.tipo}</>}
          {lotado && ativo && <span className="text-status-atencao"> · lotado</span>}
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
              const r = await chamarAction(alternarAtivoQuarto(quarto.id, proximo))
              if (!r.ok) { setErro(r.erro); setAtivo(!proximo) }
            })
          }}
        />
        {ativo ? 'Ativo' : 'Inativo'}
      </label>
    </li>
  )
}

export function PainelQuartos({ alojamentoId, quartos }: { alojamentoId: string; quartos: QuartoLinha[] }) {
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
      const r = await chamarAction(criarQuarto({ ...Object.fromEntries(fd.entries()), alojamentoId }))
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
      form.reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Quartos</h2>
        {!criando && (
          <button
            type="button" onClick={() => setCriando(true)} data-testid="novo-quarto"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Novo quarto
          </button>
        )}
      </div>

      {criando && (
        <form onSubmit={aoSubmeter} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <input name="numero" placeholder="Número / nome" required autoFocus className={CAMPO} />
            <input name="capacidade" type="number" min={1} defaultValue={4} placeholder="Lugares" required className={CAMPO} />
            <select name="tipo" defaultValue="" className={CAMPO}>
              <option value="">— sem definir —</option>
              {Object.values(TIPO_QUARTO).map((t) => (
                <option key={t} value={t}>{ROTULO_TIPO_QUARTO[t]}</option>
              ))}
            </select>
          </div>
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-quarto"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Criando…' : 'Criar quarto'}
            </button>
            <button type="button" onClick={() => { setCriando(false); setErro(null) }} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {quartos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum quarto cadastrado. Sem quartos, a capacidade do alojamento é a que foi digitada no cadastro.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm" data-testid="lista-quartos">
          {quartos.map((q) => <Linha key={q.id} quarto={q} />)}
        </ul>
      )}
    </div>
  )
}
