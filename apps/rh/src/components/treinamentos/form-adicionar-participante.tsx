'use client'

import { useState, useTransition } from 'react'
import { UserPlus } from 'lucide-react'
import { adicionarParticipante } from '@/actions/treinamentos'
import type { FuncionarioParaSelecao } from '@/queries/treinamentos'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormAdicionarParticipante({
  treinamentoId, funcionarios,
}: {
  treinamentoId: string
  funcionarios: FuncionarioParaSelecao[]
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (funcionarios.length === 0) return null

  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)}
        className="mt-3 inline-flex items-center gap-2 text-xs text-primary hover:underline"
      >
        <UserPlus className="size-3.5" /> Adicionar participante
      </button>
    )
  }

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await adicionarParticipante({ treinamentoId, funcionarioId: fd.get('funcionarioId') })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
    })
  }

  return (
    <form onSubmit={aoSubmeter} className="mt-3 flex flex-wrap items-start gap-2">
      <select name="funcionarioId" required defaultValue="" className={`${CAMPO} w-auto`}>
        <option value="" disabled>— selecione —</option>
        {funcionarios.map((f) => (
          <option key={f.id} value={f.id}>{f.nome} — {f.matricula}</option>
        ))}
      </select>
      <button
        type="submit" disabled={pendente}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pendente ? 'Adicionando…' : 'Adicionar'}
      </button>
      <button type="button" onClick={() => { setAberto(false); setErro(null) }} className="rounded-md border border-border px-3 py-2 text-sm">
        Cancelar
      </button>
      {erro && <p role="alert" className="basis-full text-xs text-destructive">{erro}</p>}
    </form>
  )
}
