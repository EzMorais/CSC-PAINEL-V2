'use client'

import { chamarAction } from '@/lib/chamar-action'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { mudarStatusSolicitacao, excluirSolicitacao } from '@/actions/solicitacoes'
import { STATUS_SOLICITACAO } from '@/lib/dominio/constantes'

const BOTAO = 'rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50'

export function AcoesStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function mudar(novo: string) {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(mudarStatusSolicitacao(id, novo))
      if (!r.ok) setErro(r.erro)
    })
  }

  function excluir() {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(excluirSolicitacao(id))
      if (!r.ok) return setErro(r.erro)
      router.push('/solicitacoes')
      router.refresh()
    })
  }

  const encerrada = status === STATUS_SOLICITACAO.ATENDIDA || status === STATUS_SOLICITACAO.CANCELADA

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === STATUS_SOLICITACAO.ENVIADA && (
          <button type="button" onClick={() => mudar(STATUS_SOLICITACAO.ATENDIDA)} disabled={pendente} className={BOTAO} data-testid="marcar-atendida">
            Marcar como atendida
          </button>
        )}
        {!encerrada && (
          <button type="button" onClick={() => mudar(STATUS_SOLICITACAO.CANCELADA)} disabled={pendente} className={BOTAO}>
            Cancelar pedido
          </button>
        )}
        {status === STATUS_SOLICITACAO.RASCUNHO && (
          <button type="button" onClick={excluir} disabled={pendente} className={`${BOTAO} text-destructive`}>
            Excluir rascunho
          </button>
        )}
      </div>

      {status === STATUS_SOLICITACAO.ATENDIDA && (
        <p className="text-xs text-muted-foreground">
          Marcar como atendida registra que o material chegou, mas não mexe no saldo — quem
          cria estoque é a entrada, lançada com a nota fiscal na mão, com a quantidade e o
          preço que vieram de verdade.
        </p>
      )}

      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
