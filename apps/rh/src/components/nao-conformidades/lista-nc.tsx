'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { atualizarStatusNaoConformidade } from '@/actions/nao-conformidades'
import {
  GRAVIDADE_NC, ROTULO_GRAVIDADE_NC, STATUS_NC, ROTULO_STATUS_NC,
  type GravidadeNc, type StatusNc,
} from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import type { NaoConformidadeListada } from '@/queries/nao-conformidades'

const CAMPO =
  'rounded-md border border-input bg-background px-2 py-1 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

const COR_GRAVIDADE: Record<string, string> = {
  BAIXA: 'bg-status-ativa/15 text-status-ativa',
  MEDIA: 'bg-status-atencao/15 text-status-atencao',
  ALTA: 'bg-status-vencida/15 text-status-vencida',
}

function LinhaNc({ nc }: { nc: NaoConformidadeListada }) {
  const [status, setStatus] = useState(nc.status)
  const [pendente, iniciar] = useTransition()
  const hoje = new Date()
  const vencida = nc.prazo && status !== STATUS_NC.RESOLVIDA ? nc.prazo < hoje : false

  function mudarStatus(novo: string) {
    setStatus(novo)
    iniciar(async () => { await atualizarStatusNaoConformidade(nc.id, { status: novo }) })
  }

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{nc.titulo}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{nc.descricao}</p>
        </div>
        <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COR_GRAVIDADE[nc.gravidade] ?? ''}`}>
          {ROTULO_GRAVIDADE_NC[nc.gravidade as GravidadeNc] ?? nc.gravidade}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {nc.responsavel && <span>Responsável: {nc.responsavel}</span>}
        {nc.prazo && <span className={vencida ? 'text-destructive' : undefined}>Prazo: {dataBR(nc.prazo)}</span>}
        {nc.auditoriaItem && (
          <Link href={`/auditorias/${nc.auditoriaItem.auditoria.id}`} className="text-primary hover:underline">
            Origem: {nc.auditoriaItem.auditoria.titulo}
          </Link>
        )}
        <select
          value={status} disabled={pendente}
          onChange={(e) => mudarStatus(e.target.value)}
          className={`${CAMPO} ml-auto`}
        >
          {Object.values(STATUS_NC).map((s: StatusNc) => <option key={s} value={s}>{ROTULO_STATUS_NC[s]}</option>)}
        </select>
      </div>
    </li>
  )
}

export function ListaNc({ linhas }: { linhas: NaoConformidadeListada[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const statusAtual = params.get('status') ?? ''
  const gravidadeAtual = params.get('gravidade') ?? ''

  function aplicar(novos: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    router.push(`/nao-conformidades${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={statusAtual} onChange={(e) => aplicar({ status: e.target.value })} aria-label="Filtrar por status" className={CAMPO}>
          <option value="">Todos os status</option>
          {Object.values(STATUS_NC).map((s: StatusNc) => <option key={s} value={s}>{ROTULO_STATUS_NC[s]}</option>)}
        </select>
        <select value={gravidadeAtual} onChange={(e) => aplicar({ gravidade: e.target.value })} aria-label="Filtrar por gravidade" className={CAMPO}>
          <option value="">Todas as gravidades</option>
          {Object.values(GRAVIDADE_NC).map((g: GravidadeNc) => <option key={g} value={g}>{ROTULO_GRAVIDADE_NC[g]}</option>)}
        </select>
      </div>

      <p className="text-sm text-muted-foreground">{linhas.length} não conformidade{linhas.length === 1 ? '' : 's'}</p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma não conformidade registrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {linhas.map((nc) => <LinhaNc key={nc.id} nc={nc} />)}
        </ul>
      )}
    </div>
  )
}
