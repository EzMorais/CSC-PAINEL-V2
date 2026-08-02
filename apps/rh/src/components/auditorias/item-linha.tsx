'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { criarNaoConformidade } from '@/actions/nao-conformidades'
import { SITUACAO_ITEM_AUDITORIA, ROTULO_SITUACAO_ITEM_AUDITORIA, GRAVIDADE_NC, ROTULO_GRAVIDADE_NC, type GravidadeNc } from '@/lib/dominio/constantes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

const COR_SITUACAO: Record<string, string> = {
  CONFORME: 'bg-status-ativa/15 text-status-ativa',
  NAO_CONFORME: 'bg-status-vencida/15 text-status-vencida',
  NAO_SE_APLICA: 'bg-muted text-muted-foreground',
}

export type ItemAuditoria = {
  id: string
  descricao: string
  situacao: string
  evidencia: string | null
  naoConformidade: { id: string } | null
}

export function ItemLinha({ item }: { item: ItemAuditoria }) {
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  // onSubmit + preventDefault, não `action` direta: evita o reset de formulário do React 19
  // ao falhar a validação (ver form-entrega.tsx em uniformes para o caso em que isso chegou
  // a causar um bug de verdade, não só perda de digitação).
  function abrirNc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await criarNaoConformidade({
        titulo: item.descricao,
        descricao: fd.get('descricao'),
        gravidade: fd.get('gravidade'),
        responsavel: fd.get('responsavel'),
        prazo: fd.get('prazo'),
        auditoriaItemId: item.id,
      })
      if (!r.ok) return setErro(r.erro)
      setAbrindo(false)
    })
  }

  return (
    <li className="space-y-2 border-b border-border/50 py-3 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm">{item.descricao}</p>
        <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO[item.situacao] ?? ''}`}>
          {ROTULO_SITUACAO_ITEM_AUDITORIA[item.situacao as keyof typeof ROTULO_SITUACAO_ITEM_AUDITORIA] ?? item.situacao}
        </span>
      </div>

      {item.evidencia && (
        <a href={item.evidencia} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Ver evidência</a>
      )}

      {item.situacao === SITUACAO_ITEM_AUDITORIA.NAO_CONFORME && (
        item.naoConformidade ? (
          <p className="text-xs">
            <Link href="/nao-conformidades" className="text-primary hover:underline">Não conformidade aberta</Link>
          </p>
        ) : abrindo ? (
          <form
            onSubmit={abrirNc}
            className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
          >
            <textarea name="descricao" placeholder="O que foi encontrado" rows={2} required className={CAMPO} />
            <div className="grid gap-2 sm:grid-cols-3">
              <select name="gravidade" defaultValue={GRAVIDADE_NC.MEDIA} className={CAMPO}>
                {Object.values(GRAVIDADE_NC).map((g: GravidadeNc) => <option key={g} value={g}>{ROTULO_GRAVIDADE_NC[g]}</option>)}
              </select>
              <input name="responsavel" placeholder="Responsável" className={CAMPO} />
              <input name="prazo" type="date" className={CAMPO} />
            </div>
            {erro && <p className="text-xs text-destructive">{erro}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={pendente} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                {pendente ? 'Abrindo…' : 'Abrir não conformidade'}
              </button>
              <button type="button" onClick={() => setAbrindo(false)} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancelar</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAbrindo(true)} className="text-xs text-destructive hover:underline">
            Abrir não conformidade a partir deste item
          </button>
        )
      )}
    </li>
  )
}
