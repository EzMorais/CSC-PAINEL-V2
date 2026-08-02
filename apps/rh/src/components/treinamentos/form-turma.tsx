'use client'

import { Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { criarTurma } from '@/actions/treinamentos'
import { NORMA_TREINAMENTO, ROTULO_NORMA_TREINAMENTO } from '@/lib/dominio/constantes'
import type { FuncionarioParaSelecao } from '@/queries/treinamentos'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormTurma({ funcionarios }: { funcionarios: FuncionarioParaSelecao[] }) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  // onSubmit + preventDefault em vez de `action={fn}`: o form action do React 19 reseta o
  // DOM do formulário assim que a função retorna, mesmo em falha de validação — perderia
  // toda a seleção de funcionários (uma lista longa de checkboxes) se a turma falhar por
  // outro motivo. Ver o mesmo comentário em uniformes/form-entrega.tsx.
  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setErro(null)
    const entrada = {
      ...Object.fromEntries(fd.entries()),
      funcionarioIds: fd.getAll('funcionarioIds'),
    }
    iniciar(async () => {
      const r = await criarTurma(entrada)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      form.reset()
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        data-testid="nova-turma"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="size-4" /> Nova turma
      </button>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="descricao" className="mb-1 block text-sm font-medium">Descrição *</label>
          <input id="descricao" name="descricao" required placeholder="Ex.: Reciclagem NR-35 — equipe de altura" className={CAMPO} />
        </div>

        <div>
          <label htmlFor="norma" className="mb-1 block text-sm font-medium">Norma *</label>
          <select id="norma" name="norma" required defaultValue={NORMA_TREINAMENTO.OUTRA} className={CAMPO}>
            {Object.values(NORMA_TREINAMENTO).map((n) => (
              <option key={n} value={n}>{ROTULO_NORMA_TREINAMENTO[n]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="instrutor" className="mb-1 block text-sm font-medium">Instrutor</label>
          <input id="instrutor" name="instrutor" className={CAMPO} />
        </div>

        <div>
          <label htmlFor="cargaHoraria" className="mb-1 block text-sm font-medium">Carga horária (h)</label>
          <input id="cargaHoraria" name="cargaHoraria" type="number" min={1} className={CAMPO} />
        </div>

        <div>
          <label htmlFor="realizadoEm" className="mb-1 block text-sm font-medium">Realizado em *</label>
          <input id="realizadoEm" name="realizadoEm" type="date" required defaultValue={hoje} className={CAMPO} />
        </div>

        <div>
          <label htmlFor="validadeEm" className="mb-1 block text-sm font-medium">Válido até</label>
          <input id="validadeEm" name="validadeEm" type="date" className={CAMPO} />
          <p className="mt-1 text-xs text-muted-foreground">Deixe em branco se o treinamento não tiver prazo de reciclagem.</p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Participantes *</p>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
          {funcionarios.map((f) => (
            <label key={f.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
              <input type="checkbox" name="funcionarioIds" value={f.id} className="size-4" />
              {f.nome} <span className="text-xs tabular text-muted-foreground">— {f.matricula}</span>
            </label>
          ))}
        </div>
      </div>

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit" disabled={pendente} data-testid="salvar-turma"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Criando…' : 'Criar turma'}
        </button>
        <button
          type="button"
          onClick={() => { setAberto(false); setErro(null) }}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
