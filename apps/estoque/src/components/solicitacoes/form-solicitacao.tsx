'use client'

import { chamarAction } from '@/lib/chamar-action'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Sparkles, X } from 'lucide-react'
import { criarSolicitacao, gerarSugestao } from '@/actions/solicitacoes'
import { brl } from '@/lib/dominio/formato'
import type { ItemSugerido } from '@/queries/solicitacoes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormSolicitacao() {
  const router = useRouter()
  const [itens, setItens] = useState<ItemSugerido[] | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sugerindo, iniciarSugestao] = useTransition()
  const [salvando, iniciarSalvar] = useTransition()

  function sugerir() {
    setErro(null)
    iniciarSugestao(async () => {
      const r = await chamarAction(gerarSugestao())
      if (!r.ok) return setErro(r.erro)
      setItens(r.dados)
    })
  }

  function alterarQuantidade(materialId: string, valor: string) {
    const n = Number(valor)
    setItens((atuais) =>
      atuais?.map((i) => (i.materialId === materialId ? { ...i, quantidadeSugerida: n } : i)) ?? null,
    )
  }

  function remover(materialId: string) {
    setItens((atuais) => atuais?.filter((i) => i.materialId !== materialId) ?? null)
  }

  function salvar() {
    if (!itens || itens.length === 0) return
    setErro(null)
    iniciarSalvar(async () => {
      const r = await chamarAction(criarSolicitacao({
        observacao,
        itens: itens.map((i) => ({
          materialId: i.materialId,
          quantidade: i.quantidadeSugerida,
          saldoNaEpoca: i.saldo,
          minimoNaEpoca: i.estoqueMinimo,
          precoEstimado: i.precoEstimado ?? '',
        })),
      }))
      if (!r.ok) return setErro(r.erro)
      // A tela do pedido mostra o estado — inclusive quando ficou aguardando a gerência.
      router.push(`/solicitacoes/${r.dados.id}`)
      router.refresh()
    })
  }

  const total = (itens ?? []).reduce(
    (s, i) => s + (i.precoEstimado != null ? i.precoEstimado * i.quantidadeSugerida : 0),
    0,
  )
  const invalidos = (itens ?? []).filter((i) => !(i.quantidadeSugerida > 0))

  if (!itens) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-medium">Montar pedido a partir do que está faltando</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O sistema junta tudo que está sem estoque ou abaixo do mínimo e sugere a quantidade
            para repor até o dobro do mínimo — comprar só o que falta para bater o mínimo
            deixaria o item no limite de novo na semana seguinte. Dá para editar tudo antes de
            salvar.
          </p>
        </div>
        {erro && <p role="alert" data-testid="erro-form" className="text-sm text-destructive">{erro}</p>}
        <button
          type="button" onClick={sugerir} disabled={sugerindo} data-testid="gerar-sugestao"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Sparkles className="size-4" /> {sugerindo ? 'Consultando o estoque…' : 'Gerar sugestão'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{itens.length} {itens.length === 1 ? 'item sugerido' : 'itens sugeridos'}</h2>
        <button type="button" onClick={() => { setItens(null); setErro(null) }} className="text-xs text-muted-foreground hover:text-foreground">
          Recomeçar
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Material</th>
              <th className="whitespace-nowrap pb-2 px-3 text-right font-medium">Saldo / mín.</th>
              <th className="whitespace-nowrap pb-2 px-3 text-right font-medium">Comprar</th>
              <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Estimativa</th>
              <th className="pb-2 pl-3"></th>
            </tr>
          </thead>
          <tbody data-testid="itens-sugeridos">
            {itens.map((i) => (
              <tr key={i.materialId} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-3">
                  <span className="font-medium">{i.nome}</span>
                  <span className="block text-xs tabular text-muted-foreground">{i.codigo}</span>
                </td>
                <td className="whitespace-nowrap py-2 px-3 text-right tabular text-muted-foreground">
                  {i.saldo} / {i.estoqueMinimo || '—'} {i.unidade}
                </td>
                <td className="py-2 px-3 text-right">
                  <input
                    type="number" min={0} step="any" value={i.quantidadeSugerida}
                    onChange={(e) => alterarQuantidade(i.materialId, e.target.value)}
                    aria-label={`Quantidade de ${i.nome}`}
                    className={`${CAMPO} w-24 text-right`}
                  />
                </td>
                <td className="py-2 pl-3 text-right tabular text-muted-foreground">
                  {i.precoEstimado != null ? brl(i.precoEstimado * i.quantidadeSugerida) : '—'}
                </td>
                <td className="py-2 pl-3 text-right">
                  <button
                    type="button" onClick={() => remover(i.materialId)}
                    aria-label={`Remover ${i.nome}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <p className="text-right text-sm">
          Estimativa pela última compra: <span className="tabular font-medium">{brl(total)}</span>
        </p>
      )}

      <div>
        <label htmlFor="observacao" className="mb-1 block text-sm font-medium">Observação para o fornecedor</label>
        <textarea
          id="observacao" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)}
          placeholder="Prazo desejado, condição de entrega…" className={CAMPO}
        />
      </div>

      {invalidos.length > 0 && (
        <p className="text-xs text-destructive">
          {invalidos.length} item com quantidade zerada — corrija ou remova antes de salvar.
        </p>
      )}
      {erro && <p role="alert" data-testid="erro-form" className="text-sm text-destructive">{erro}</p>}

      <button
        type="button" onClick={salvar} data-testid="salvar-solicitacao"
        disabled={salvando || itens.length === 0 || invalidos.length > 0}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {salvando ? 'Criando…' : 'Criar solicitação'}
      </button>
    </div>
  )
}
