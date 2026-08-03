'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { chamarAction } from '@/lib/chamar-action'
import { criarPedido } from '@/actions/pedidos'
import {
  PRIORIDADE_PEDIDO, ROTULO_PRIORIDADE_PEDIDO, ROTULO_TIPO_PEDIDO, TIPO_PEDIDO,
} from '@/lib/dominio/constantes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Morador = { id: string; nome: string; alojamentoId: string }

export function FormPedido({
  alojamentos, moradores,
}: {
  alojamentos: Array<{ id: string; nome: string }>
  moradores: Morador[]
}) {
  const router = useRouter()
  const [alojamentoId, setAlojamentoId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  // Só os moradores do alojamento escolhido: numa lista com todo mundo, o mais fácil é
  // marcar a pessoa errada, de outro prédio.
  const doAlojamento = moradores.filter((m) => m.alojamentoId === alojamentoId)

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(criarPedido(Object.fromEntries(fd.entries())))
      if (!r.ok) return setErro(r.erro)
      router.push('/pedidos')
      router.refresh()
    })
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="alojamentoId" className="mb-1 block text-sm font-medium">Alojamento *</label>
          <select
            id="alojamentoId" name="alojamentoId" required value={alojamentoId}
            onChange={(e) => setAlojamentoId(e.target.value)} className={CAMPO}
          >
            <option value="">— escolha —</option>
            {alojamentos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="tipo" className="mb-1 block text-sm font-medium">Tipo *</label>
          <select id="tipo" name="tipo" required defaultValue={TIPO_PEDIDO.LIMPEZA} className={CAMPO}>
            {Object.values(TIPO_PEDIDO).map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_PEDIDO[t]}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="titulo" className="mb-1 block text-sm font-medium">O que precisa *</label>
          <input
            id="titulo" name="titulo" required autoFocus
            placeholder="Ex.: 6 rolos de papel higiênico" className={CAMPO}
          />
        </div>

        <div>
          <label htmlFor="alocacaoId" className="mb-1 block text-sm font-medium">Quem pediu</label>
          <select id="alocacaoId" name="alocacaoId" defaultValue="" className={CAMPO} disabled={!alojamentoId}>
            <option value="">— pedido do alojamento —</option>
            {doAlojamento.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Deixe vazio se for do alojamento todo.</p>
        </div>

        <div>
          <label htmlFor="prioridade" className="mb-1 block text-sm font-medium">Prioridade</label>
          <select id="prioridade" name="prioridade" defaultValue={PRIORIDADE_PEDIDO.NORMAL} className={CAMPO}>
            {Object.values(PRIORIDADE_PEDIDO).map((p) => (
              <option key={p} value={p}>{ROTULO_PRIORIDADE_PEDIDO[p]}</option>
            ))}
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
          type="submit" disabled={pendente} data-testid="salvar-pedido"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Registrando…' : 'Registrar pedido'}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
