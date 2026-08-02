'use client'

import { useState, useTransition } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { ajustarPorInventario } from '@/actions/movimentacoes'
import { alternarAtivoMaterial } from '@/actions/materiais'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function PainelInventario({
  materialId, unidade, saldo, ativo,
}: {
  materialId: string
  unidade: string
  saldo: number
  ativo: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [alternando, iniciarAlternar] = useTransition()

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const r = await ajustarPorInventario({
        materialId,
        quantidadeContada: fd.get('quantidadeContada'),
        observacao: fd.get('observacao'),
      })
      if (!r.ok) return setErro(r.erro)
      const d = r.dados.diferenca
      setAviso(`Ajuste lançado: ${d > 0 ? 'sobra' : 'falta'} de ${Math.abs(d)} ${unidade}.`)
      setAberto(false)
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Inventário</h2>

      {aviso && (
        <p role="status" className="rounded-md border border-border bg-muted/40 p-2 text-xs">{aviso}</p>
      )}

      {aberto ? (
        <form onSubmit={aoSubmeter} className="space-y-2">
          <div>
            <label htmlFor="quantidadeContada" className="mb-1 block text-sm font-medium">
              Quantidade contada ({unidade}) *
            </label>
            <input
              id="quantidadeContada" name="quantidadeContada" type="number" min={0} step="any"
              required autoFocus defaultValue={saldo} className={CAMPO}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Digite o que você contou na prateleira. O sistema calcula a diferença sozinho.
            </p>
          </div>
          <div>
            <label htmlFor="observacao" className="mb-1 block text-sm font-medium">Observação</label>
            <input id="observacao" name="observacao" className={CAMPO} />
          </div>
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-inventario"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Ajustando…' : 'Lançar ajuste'}
            </button>
            <button
              type="button" onClick={() => { setAberto(false); setErro(null) }}
              className="rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button" onClick={() => { setAberto(true); setAviso(null) }} data-testid="abrir-inventario"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs"
        >
          <ClipboardCheck className="size-3.5" /> Conferir contagem física
        </button>
      )}

      <div className="border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox" checked={ativo} disabled={alternando}
            onChange={(e) => {
              const proximo = e.target.checked
              iniciarAlternar(async () => { await alternarAtivoMaterial(materialId, proximo) })
            }}
          />
          Material ativo
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Inativo some das listas de lançamento, mas o histórico continua inteiro.
        </p>
      </div>
    </div>
  )
}
