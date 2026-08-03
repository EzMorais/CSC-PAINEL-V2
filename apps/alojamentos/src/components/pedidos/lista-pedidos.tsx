'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Play, X } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { atualizarStatusPedido } from '@/actions/pedidos'
import { SeloStatusPedido, SeloTipoPedido, Selo } from '@/components/selo'
import { PRIORIDADE_PEDIDO, ROTULO_PRIORIDADE_PEDIDO, STATUS_PEDIDO } from '@/lib/dominio/constantes'
import { dataLocalBR } from '@/lib/dominio/formato'

export type PedidoListado = {
  id: string
  tipo: string
  titulo: string
  descricao: string | null
  status: string
  prioridade: string
  funcionarioNome: string | null
  atendidoPor: string | null
  atendidoEm: Date | null
  respostaObservacao: string | null
  criadoEm: Date
  registradoPor: string | null
  alojamento: { nome: string }
}

const BOTAO = 'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50'

function Linha({ p }: { p: PedidoListado }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const aberto = p.status === STATUS_PEDIDO.ABERTO || p.status === STATUS_PEDIDO.EM_ANDAMENTO

  function mudar(status: string) {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(atualizarStatusPedido(p.id, { status }))
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium">{p.titulo}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <SeloTipoPedido tipo={p.tipo} />
            {p.prioridade === PRIORIDADE_PEDIDO.ALTA && (
              <Selo texto={ROTULO_PRIORIDADE_PEDIDO.ALTA} tom="vencida" />
            )}
            <span>{p.alojamento.nome}</span>
            {p.funcionarioNome && <span>· {p.funcionarioNome}</span>}
            <span>· {dataLocalBR(p.criadoEm)}</span>
          </p>
          {p.descricao && <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>}
          {p.atendidoPor && (
            <p className="mt-1 text-xs text-muted-foreground">
              Resolvido por {p.atendidoPor}
              {p.respostaObservacao && <> — {p.respostaObservacao}</>}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SeloStatusPedido status={p.status} />
          {aberto && (
            <>
              {p.status === STATUS_PEDIDO.ABERTO && (
                <button type="button" onClick={() => mudar(STATUS_PEDIDO.EM_ANDAMENTO)} disabled={pendente} className={BOTAO}>
                  <Play className="size-3.5" /> Começar
                </button>
              )}
              <button
                type="button" onClick={() => mudar(STATUS_PEDIDO.ATENDIDO)} disabled={pendente}
                data-testid={`atender-${p.id}`} className={BOTAO}
              >
                <Check className="size-3.5" /> Atendido
              </button>
              <button type="button" onClick={() => mudar(STATUS_PEDIDO.CANCELADO)} disabled={pendente} className={BOTAO}>
                <X className="size-3.5" /> Cancelar
              </button>
            </>
          )}
        </div>
      </div>
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    </li>
  )
}

export function ListaPedidos({ pedidos }: { pedidos: PedidoListado[] }) {
  if (pedidos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nenhum pedido por aqui.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm shadow-sm" data-testid="lista-pedidos">
      {pedidos.map((p) => <Linha key={p.id} p={p} />)}
    </ul>
  )
}
