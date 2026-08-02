'use client'

import { Plus } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
import { registrarDocumentoEmpresa } from '@/actions/documentos'
import { CATEGORIA_DOCUMENTO_EMPRESA, ROTULO_CATEGORIA_DOCUMENTO_EMPRESA } from '@/lib/dominio/constantes'
import type { ObraParaSelecao } from '@/queries/documentos'

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

export function FormDocumentoEmpresa({ obras }: { obras: ObraParaSelecao[] }) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const arquivoRef = useRef<File | null>(null)

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const arquivo = arquivoRef.current ? await lerComoDataUri(arquivoRef.current) : ''
      const r = await registrarDocumentoEmpresa({ ...Object.fromEntries(fd.entries()), arquivo })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      arquivoRef.current = null
    })
  }

  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)} data-testid="novo-documento-empresa"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="size-4" /> Novo documento
      </button>
    )
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="categoria" className="mb-1 block text-sm font-medium">Categoria *</label>
          <select id="categoria" name="categoria" required defaultValue={CATEGORIA_DOCUMENTO_EMPRESA.PGR} className={CAMPO}>
            {Object.values(CATEGORIA_DOCUMENTO_EMPRESA).map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA_DOCUMENTO_EMPRESA[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="titulo" className="mb-1 block text-sm font-medium">Título *</label>
          <input id="titulo" name="titulo" required placeholder="Ex.: PGR — matriz 2026" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="obraId" className="mb-1 block text-sm font-medium">Obra</label>
          <select id="obraId" name="obraId" defaultValue="" className={CAMPO}>
            <option value="">— documento da empresa toda —</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} — {o.descricao}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="vigenteDesde" className="mb-1 block text-sm font-medium">Vigente desde</label>
          <input id="vigenteDesde" name="vigenteDesde" type="date" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="validoAte" className="mb-1 block text-sm font-medium">Válido até</label>
          <input id="validoAte" name="validoAte" type="date" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="arquivo" className="mb-1 block text-sm font-medium">Arquivo (PDF ou imagem)</label>
          <input
            id="arquivo" type="file" accept="application/pdf,image/*" className={CAMPO}
            onChange={(e) => { arquivoRef.current = e.target.files?.[0] ?? null }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="observacao" className="mb-1 block text-sm font-medium">Observação</label>
        <textarea id="observacao" name="observacao" rows={2} className={CAMPO} />
      </div>

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit" disabled={pendente} data-testid="salvar-documento-empresa"
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
