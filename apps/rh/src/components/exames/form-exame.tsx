'use client'

import { Plus } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
import { registrarExame } from '@/actions/exames'
import {
  TIPO_EXAME, ROTULO_TIPO_EXAME, RESULTADO_EXAME, ROTULO_RESULTADO_EXAME, type ResultadoExame,
} from '@/lib/dominio/constantes'
import type { FuncionarioParaExame } from '@/queries/exames'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Lê o arquivo escolhido como data URI — sem armazenamento próprio neste app, só texto no SQLite. */
function lerComoDataUri(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(arquivo)
  })
}

export function FormExame({ funcionarios }: { funcionarios: FuncionarioParaExame[] }) {
  const [aberto, setAberto] = useState(false)
  const [resultado, setResultado] = useState<ResultadoExame>(RESULTADO_EXAME.APTO)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const arquivoRef = useRef<File | null>(null)

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const arquivo = arquivoRef.current ? await lerComoDataUri(arquivoRef.current) : ''
      const entrada = { ...Object.fromEntries(fd.entries()), arquivo }
      const r = await registrarExame(entrada)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      setResultado(RESULTADO_EXAME.APTO)
      arquivoRef.current = null
    })
  }

  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)} data-testid="novo-exame"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="size-4" /> Novo exame
      </button>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="funcionarioId" className="mb-1 block text-sm font-medium">Funcionário *</label>
          <select id="funcionarioId" name="funcionarioId" required defaultValue="" className={CAMPO}>
            <option value="" disabled>— selecione —</option>
            {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome} — {f.matricula}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="tipo" className="mb-1 block text-sm font-medium">Tipo *</label>
          <select id="tipo" name="tipo" required defaultValue={TIPO_EXAME.PERIODICO} className={CAMPO}>
            {Object.values(TIPO_EXAME).map((t) => <option key={t} value={t}>{ROTULO_TIPO_EXAME[t]}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="realizadoEm" className="mb-1 block text-sm font-medium">Realizado em *</label>
          <input id="realizadoEm" name="realizadoEm" type="date" required defaultValue={hoje} className={CAMPO} />
        </div>

        <div>
          <label htmlFor="validadeEm" className="mb-1 block text-sm font-medium">Válido até</label>
          <input id="validadeEm" name="validadeEm" type="date" className={CAMPO} />
          <p className="mt-1 text-xs text-muted-foreground">Deixe em branco se não houver prazo de reciclagem.</p>
        </div>

        <div>
          <label htmlFor="resultado" className="mb-1 block text-sm font-medium">Resultado *</label>
          <select
            id="resultado" name="resultado" required value={resultado}
            onChange={(e) => setResultado(e.target.value as ResultadoExame)}
            className={CAMPO}
          >
            {Object.values(RESULTADO_EXAME).map((r) => <option key={r} value={r}>{ROTULO_RESULTADO_EXAME[r]}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="arquivo" className="mb-1 block text-sm font-medium">ASO (PDF ou foto)</label>
          <input
            id="arquivo" type="file" accept="application/pdf,image/*" className={CAMPO}
            onChange={(e) => { arquivoRef.current = e.target.files?.[0] ?? null }}
          />
        </div>
      </div>

      {resultado === RESULTADO_EXAME.APTO_COM_RESTRICAO && (
        <div>
          <label htmlFor="restricoes" className="mb-1 block text-sm font-medium">Restrições *</label>
          <textarea id="restricoes" name="restricoes" rows={2} required className={CAMPO} />
        </div>
      )}

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit" disabled={pendente} data-testid="salvar-exame"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Registrar'}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
