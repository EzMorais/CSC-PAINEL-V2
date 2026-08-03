'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { chamarAction } from '@/lib/chamar-action'
import { criarProgramacao } from '@/actions/programacao'
import { ROTULO_TIPO_PROGRAMACAO, TIPO_PROGRAMACAO } from '@/lib/dominio/constantes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormProgramacao({
  alojamentos, dataInicial,
}: {
  alojamentos: Array<{ id: string; nome: string }>
  dataInicial: string
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const dados = Object.fromEntries(fd.entries())
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(criarProgramacao(dados))
      if (!r.ok) return setErro(r.erro)
      router.push(`/programacao?data=${String(dados.data)}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="data" className="mb-1 block text-sm font-medium">Dia *</label>
          <input id="data" name="data" type="date" required defaultValue={dataInicial} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="tipo" className="mb-1 block text-sm font-medium">Tipo *</label>
          <select id="tipo" name="tipo" required defaultValue={TIPO_PROGRAMACAO.AVISO} className={CAMPO}>
            {Object.values(TIPO_PROGRAMACAO).map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_PROGRAMACAO[t]}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="titulo" className="mb-1 block text-sm font-medium">O que vai acontecer *</label>
          <input
            id="titulo" name="titulo" required autoFocus
            placeholder="Ex.: Saída do ônibus para a obra EX-1001-25" className={CAMPO}
          />
        </div>

        <div>
          <label htmlFor="horario" className="mb-1 block text-sm font-medium">Horário</label>
          <input id="horario" name="horario" placeholder="06:00, após o almoço…" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="responsavelNome" className="mb-1 block text-sm font-medium">Responsável</label>
          <input id="responsavelNome" name="responsavelNome" className={CAMPO} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="alojamentoId" className="mb-1 block text-sm font-medium">Alojamento</label>
          <select id="alojamentoId" name="alojamentoId" defaultValue="" className={CAMPO}>
            <option value="">Todos os alojamentos (aviso geral)</option>
            {alojamentos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="descricao" className="mb-1 block text-sm font-medium">Detalhes</label>
          <textarea id="descricao" name="descricao" rows={3} className={CAMPO} />
        </div>
      </div>

      {erro && <p role="alert" data-testid="erro-form" className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="submit" disabled={pendente} data-testid="salvar-programacao"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Adicionar à programação'}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
