'use client'

import { chamarAction } from '@/lib/chamar-action'

import { useState, useTransition } from 'react'
import { Check, X, Clock, Info } from 'lucide-react'
import { aprovar, rejeitar } from '@/actions/aprovacoes'
import {
  ROTULO_TIPO_APROVACAO, MOTIVO_DA_REGRA, STATUS_APROVACAO,
  ROTULO_STATUS_APROVACAO, TOM_STATUS_APROVACAO,
  type TipoAprovacao, type StatusAprovacao,
} from '@/lib/dominio/aprovacoes'
import type { AprovacaoListada } from '@/queries/aprovacoes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

const COR_TOM: Record<string, string> = {
  ativa: 'bg-status-ativa/15 text-status-ativa',
  atencao: 'bg-status-atencao/15 text-status-atencao',
  vencida: 'bg-status-vencida/15 text-status-vencida',
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

function Linha({ a, podeDecidir, souOSolicitante }: {
  a: AprovacaoListada
  podeDecidir: boolean
  souOSolicitante: boolean
}) {
  const [recusando, setRecusando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const pendenteDecisao = a.status === STATUS_APROVACAO.PENDENTE
  const tom = TOM_STATUS_APROVACAO[a.status as StatusAprovacao] ?? 'atencao'

  function decidirAprovar() {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(aprovar(a.id))
      if (!r.ok) setErro(r.erro)
    })
  }

  function decidirRejeitar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(rejeitar(a.id, { motivo: fd.get('motivo') }))
      if (!r.ok) return setErro(r.erro)
      setRecusando(false)
    })
  }

  return (
    <li className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{ROTULO_TIPO_APROVACAO[a.tipo as TipoAprovacao] ?? a.tipo}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{a.resumo}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COR_TOM[tom]}`}>
          {ROTULO_STATUS_APROVACAO[a.status as StatusAprovacao] ?? a.status}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Pedido por <strong>{a.solicitanteNome}</strong> em {DATA_HORA.format(a.criadoEm)}
        {a.aprovadorNome && (
          <> · decidido por {a.aprovadorNome}{a.decididoEm ? ` em ${DATA_HORA.format(a.decididoEm)}` : ''}</>
        )}
      </p>

      {a.motivo && <p className="text-xs text-muted-foreground">Justificativa: {a.motivo}</p>}
      {a.motivoRejeicao && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
          Recusado: {a.motivoRejeicao}
        </p>
      )}

      {pendenteDecisao && (
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {MOTIVO_DA_REGRA[a.tipo as TipoAprovacao]}
        </p>
      )}

      {pendenteDecisao && podeDecidir && !souOSolicitante && (
        recusando ? (
          <form onSubmit={decidirRejeitar} className="space-y-2">
            <input
              name="motivo" required autoFocus placeholder="Por que está recusando?"
              data-testid="motivo-rejeicao" className={CAMPO}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={pendente} className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50">
                {pendente ? 'Recusando…' : 'Confirmar recusa'}
              </button>
              <button type="button" onClick={() => setRecusando(false)} className="rounded-md border border-border px-3 py-1.5 text-xs">
                Voltar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={decidirAprovar} disabled={pendente} data-testid={`aprovar-${a.id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Check className="size-3.5" /> {pendente ? 'Aprovando…' : 'Aprovar'}
            </button>
            <button
              type="button" onClick={() => setRecusando(true)} disabled={pendente} data-testid={`recusar-${a.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
            >
              <X className="size-3.5" /> Recusar
            </button>
          </div>
        )
      )}

      {pendenteDecisao && souOSolicitante && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          Você fez este pedido — quem decide tem de ser outra pessoa.
        </p>
      )}

      {pendenteDecisao && !podeDecidir && !souOSolicitante && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> Aguardando a gerência.
        </p>
      )}

      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    </li>
  )
}

export function FilaAprovacoes({
  aprovacoes, podeDecidir, meuId,
}: {
  aprovacoes: AprovacaoListada[]
  podeDecidir: boolean
  meuId: string
}) {
  if (aprovacoes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nada aguardando decisão.
      </p>
    )
  }

  return (
    <ul className="space-y-3" data-testid="fila-aprovacoes">
      {aprovacoes.map((a) => (
        <Linha key={a.id} a={a} podeDecidir={podeDecidir} souOSolicitante={a.solicitanteId === meuId} />
      ))}
    </ul>
  )
}
