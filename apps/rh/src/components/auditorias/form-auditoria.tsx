'use client'

import { Plus, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { criarAuditoria } from '@/actions/auditorias'
import { SITUACAO_ITEM_AUDITORIA, ROTULO_SITUACAO_ITEM_AUDITORIA, type SituacaoItemAuditoria } from '@/lib/dominio/constantes'
import type { ObraParaSelecao } from '@/queries/auditorias'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

type ItemForm = { descricao: string; situacao: SituacaoItemAuditoria; arquivo: File | null }

function lerComoDataUri(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(arquivo)
  })
}

const ITEM_VAZIO: ItemForm = { descricao: '', situacao: SITUACAO_ITEM_AUDITORIA.CONFORME, arquivo: null }

export function FormAuditoria({ obras }: { obras: ObraParaSelecao[] }) {
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<ItemForm[]>([{ ...ITEM_VAZIO }])
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function atualizarItem(indice: number, patch: Partial<ItemForm>) {
    setItens((atuais) => atuais.map((it, i) => (i === indice ? { ...it, ...patch } : it)))
  }

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const itensProntos = await Promise.all(
        itens.map(async (it) => ({
          descricao: it.descricao,
          situacao: it.situacao,
          evidencia: it.arquivo ? await lerComoDataUri(it.arquivo) : '',
        })),
      )
      const r = await criarAuditoria({ ...Object.fromEntries(fd.entries()), itens: itensProntos })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      setItens([{ ...ITEM_VAZIO }])
    })
  }

  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)} data-testid="nova-auditoria"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="size-4" /> Nova auditoria
      </button>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="titulo" className="mb-1 block text-sm font-medium">Título *</label>
          <input id="titulo" name="titulo" required placeholder="Ex.: Auditoria NR-18 — canteiro EX-1001" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="norma" className="mb-1 block text-sm font-medium">Norma</label>
          <input id="norma" name="norma" placeholder="Ex.: NR-18" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="obraId" className="mb-1 block text-sm font-medium">Obra</label>
          <select id="obraId" name="obraId" defaultValue="" className={CAMPO}>
            <option value="">— sem obra específica —</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo} — {o.descricao}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="realizadaEm" className="mb-1 block text-sm font-medium">Realizada em *</label>
          <input id="realizadaEm" name="realizadaEm" type="date" required defaultValue={hoje} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="responsavel" className="mb-1 block text-sm font-medium">Responsável</label>
          <input id="responsavel" name="responsavel" className={CAMPO} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Checklist *</p>
        {itens.map((item, i) => (
          <div key={i} className="flex flex-wrap items-start gap-2 rounded-md border border-border p-2">
            <input
              value={item.descricao} onChange={(e) => atualizarItem(i, { descricao: e.target.value })}
              placeholder="Descrição do item" className={`${CAMPO} min-w-0 flex-1`}
            />
            <select
              value={item.situacao} onChange={(e) => atualizarItem(i, { situacao: e.target.value as SituacaoItemAuditoria })}
              className={`${CAMPO} w-auto`}
            >
              {Object.values(SITUACAO_ITEM_AUDITORIA).map((s) => <option key={s} value={s}>{ROTULO_SITUACAO_ITEM_AUDITORIA[s]}</option>)}
            </select>
            <input
              type="file" accept="image/*" className="w-auto text-xs"
              onChange={(e) => atualizarItem(i, { arquivo: e.target.files?.[0] ?? null })}
            />
            {itens.length > 1 && (
              <button type="button" onClick={() => setItens((atuais) => atuais.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button" onClick={() => setItens((atuais) => [...atuais, { ...ITEM_VAZIO }])}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="size-3.5" /> Adicionar item
        </button>
      </div>

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit" disabled={pendente} data-testid="salvar-auditoria"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Registrar auditoria'}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
