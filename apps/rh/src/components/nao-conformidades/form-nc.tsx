'use client'

import { Plus } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
import { criarNaoConformidade } from '@/actions/nao-conformidades'
import { GRAVIDADE_NC, ROTULO_GRAVIDADE_NC } from '@/lib/dominio/constantes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

function lerComoDataUri(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(arquivo)
  })
}

export function FormNc() {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const arquivoRef = useRef<File | null>(null)

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const evidenciaAntes = arquivoRef.current ? await lerComoDataUri(arquivoRef.current) : ''
      const r = await criarNaoConformidade({ ...Object.fromEntries(fd.entries()), evidenciaAntes })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      arquivoRef.current = null
    })
  }

  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)} data-testid="nova-nc"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="size-4" /> Nova não conformidade
      </button>
    )
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <label htmlFor="titulo" className="mb-1 block text-sm font-medium">Título *</label>
        <input id="titulo" name="titulo" required className={CAMPO} />
      </div>
      <div>
        <label htmlFor="descricao" className="mb-1 block text-sm font-medium">O que foi encontrado *</label>
        <textarea id="descricao" name="descricao" rows={2} required className={CAMPO} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="gravidade" className="mb-1 block text-sm font-medium">Gravidade *</label>
          <select id="gravidade" name="gravidade" required defaultValue={GRAVIDADE_NC.MEDIA} className={CAMPO}>
            {Object.values(GRAVIDADE_NC).map((g) => <option key={g} value={g}>{ROTULO_GRAVIDADE_NC[g]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="responsavel" className="mb-1 block text-sm font-medium">Responsável</label>
          <input id="responsavel" name="responsavel" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="prazo" className="mb-1 block text-sm font-medium">Prazo</label>
          <input id="prazo" name="prazo" type="date" className={CAMPO} />
        </div>
      </div>
      <div>
        <label htmlFor="evidencia" className="mb-1 block text-sm font-medium">Evidência (foto do antes)</label>
        <input id="evidencia" type="file" accept="image/*" className={CAMPO} onChange={(e) => { arquivoRef.current = e.target.files?.[0] ?? null }} />
      </div>

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pendente} data-testid="salvar-nc" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pendente ? 'Salvando…' : 'Registrar'}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
