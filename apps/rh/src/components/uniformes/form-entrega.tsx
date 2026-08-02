'use client'

import { Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { registrarEntrega } from '@/actions/uniformes'
import { AssinaturaPad } from './assinatura-pad'
import {
  PECA_UNIFORME, ROTULO_PECA_UNIFORME,
  MOTIVO_ENTREGA_UNIFORME, ROTULO_MOTIVO_ENTREGA_UNIFORME,
  type PecaUniforme,
} from '@/lib/dominio/constantes'
import type { FuncionarioParaEntrega } from '@/queries/uniformes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Peças cujo tamanho já mora no cadastro do funcionário. `OUTRO` não tem campo próprio — tamanho sempre manual. */
const CAMPO_TAMANHO_POR_PECA: Partial<Record<PecaUniforme, keyof FuncionarioParaEntrega>> = {
  CAMISA: 'tamanhoCamisa',
  CALCA: 'tamanhoCalca',
  CALCADO: 'tamanhoCalcado',
}

export function FormEntrega({ funcionarios }: { funcionarios: FuncionarioParaEntrega[] }) {
  const [aberto, setAberto] = useState(false)
  const [funcionarioId, setFuncionarioId] = useState('')
  const [peca, setPeca] = useState<PecaUniforme>(PECA_UNIFORME.CAMISA)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const funcionario = funcionarios.find((f) => f.id === funcionarioId)
  const campoTamanho = CAMPO_TAMANHO_POR_PECA[peca]
  const tamanhoSugerido = campoTamanho ? ((funcionario?.[campoTamanho] as string | null) ?? '') : ''

  function reiniciar() {
    setFuncionarioId('')
    setPeca(PECA_UNIFORME.CAMISA)
    setErro(null)
  }

  // `<form action={fn}>` reseta o DOM do formulário (via form.reset() nativo) assim que a
  // action retorna — inclusive quando ela falha na validação, e inclusive para os selects
  // controlados (funcionarioId/peca), cujo valor no DOM volta para a primeira opção sem que
  // o estado do React mude junto. O próximo envio then lê o FormData já dessincronizado —
  // parece que a seleção "voltou ao padrão" sozinha. `onSubmit` com `preventDefault` não tem
  // esse reset automático, por isso o formulário usa esse caminho em vez do de action direta.
  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    if (!fd.get('assinatura')) {
      setErro('Colete a assinatura de recebimento antes de salvar.')
      return
    }
    iniciar(async () => {
      const r = await registrarEntrega(Object.fromEntries(fd.entries()))
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      reiniciar()
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        data-testid="nova-entrega"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="size-4" /> Nova entrega
      </button>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="funcionarioId" className="mb-1 block text-sm font-medium">Funcionário *</label>
          <select
            id="funcionarioId" name="funcionarioId" required
            value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)}
            className={CAMPO}
          >
            <option value="">— selecione —</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>{f.nome} — {f.matricula}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="peca" className="mb-1 block text-sm font-medium">Peça *</label>
          <select
            id="peca" name="peca" required
            value={peca} onChange={(e) => setPeca(e.target.value as PecaUniforme)}
            className={CAMPO}
          >
            {Object.values(PECA_UNIFORME).map((p) => (
              <option key={p} value={p}>{ROTULO_PECA_UNIFORME[p]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tamanho" className="mb-1 block text-sm font-medium">Tamanho *</label>
          <input
            // Remonta ao trocar funcionário/peça, para o defaultValue puxar de novo o
            // tamanho do cadastro sem transformar o campo num controlado.
            key={`${funcionarioId}-${peca}`}
            id="tamanho" name="tamanho" required defaultValue={tamanhoSugerido} className={CAMPO}
          />
          {funcionarioId && campoTamanho && !tamanhoSugerido && (
            <p className="mt-1 text-xs text-muted-foreground">Tamanho não cadastrado — informe manualmente.</p>
          )}
        </div>

        <div>
          <label htmlFor="quantidade" className="mb-1 block text-sm font-medium">Quantidade *</label>
          <input id="quantidade" name="quantidade" type="number" min={1} required defaultValue={1} className={CAMPO} />
        </div>

        <div>
          <label htmlFor="motivo" className="mb-1 block text-sm font-medium">Motivo *</label>
          <select id="motivo" name="motivo" required defaultValue={MOTIVO_ENTREGA_UNIFORME.ADMISSAO} className={CAMPO}>
            {Object.values(MOTIVO_ENTREGA_UNIFORME).map((m) => (
              <option key={m} value={m}>{ROTULO_MOTIVO_ENTREGA_UNIFORME[m]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="entregueEm" className="mb-1 block text-sm font-medium">Data da entrega *</label>
          <input id="entregueEm" name="entregueEm" type="date" required defaultValue={hoje} className={CAMPO} />
        </div>
      </div>

      <div>
        <label htmlFor="observacao" className="mb-1 block text-sm font-medium">Observação</label>
        <textarea id="observacao" name="observacao" rows={2} className={CAMPO} />
      </div>

      <AssinaturaPad name="assinatura" />

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit" disabled={pendente} data-testid="salvar-entrega"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Registrando…' : 'Registrar'}
        </button>
        <button
          type="button"
          onClick={() => { setAberto(false); reiniciar() }}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
