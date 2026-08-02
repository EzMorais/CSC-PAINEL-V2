'use client'

import { chamarAction } from '@/lib/chamar-action'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Search, X } from 'lucide-react'
import { criarSolicitacao, gerarSugestao, buscarMateriaisParaPedido } from '@/actions/solicitacoes'
import { brl } from '@/lib/dominio/formato'
import type { ItemSugerido } from '@/queries/solicitacoes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormSolicitacao() {
  const router = useRouter()
  const [itens, setItens] = useState<ItemSugerido[]>([])
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sugerindo, iniciarSugestao] = useTransition()
  const [salvando, iniciarSalvar] = useTransition()

  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ItemSugerido[]>([])
  const [pesquisando, setPesquisando] = useState(false)
  const buscaRef = useRef<HTMLDivElement>(null)

  // Busca com um pequeno atraso: sem isto, cada tecla digitada dispararia uma consulta ao
  // banco — com o atraso, só a última letra de uma digitação rápida chega a pedir alguma coisa.
  useEffect(() => {
    // Abaixo de 2 letras não busca nada — a tela esconde o resultado antigo (ver JSX)
    // sem precisar zerar o estado aqui dentro.
    if (busca.trim().length < 2) return
    let cancelado = false
    const tempo = setTimeout(async () => {
      setPesquisando(true)
      const r = await chamarAction(buscarMateriaisParaPedido(busca))
      if (cancelado) return
      setPesquisando(false)
      if (r.ok) setResultados(r.dados.filter((m) => !itens.some((i) => i.materialId === m.materialId)))
    }, 300)
    return () => { cancelado = true; clearTimeout(tempo) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refazer a busca a cada item adicionado giraria a lista à toa; o filtro contra duplicata já acontece de novo no clique.
  }, [busca])

  useEffect(() => {
    if (resultados.length === 0) return
    function aoClicarFora(e: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) setResultados([])
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [resultados.length])

  function adicionarItem(item: ItemSugerido) {
    setItens((atuais) => (atuais.some((i) => i.materialId === item.materialId) ? atuais : [...atuais, item]))
    setBusca('')
    setResultados([])
  }

  function sugerir() {
    setErro(null)
    iniciarSugestao(async () => {
      const r = await chamarAction(gerarSugestao())
      if (!r.ok) return setErro(r.erro)
      setItens((atuais) => {
        const existentes = new Set(atuais.map((i) => i.materialId))
        return [...atuais, ...r.dados.filter((i) => !existentes.has(i.materialId))]
      })
    })
  }

  function alterarQuantidade(materialId: string, valor: string) {
    const n = Number(valor)
    setItens((atuais) => atuais.map((i) => (i.materialId === materialId ? { ...i, quantidadeSugerida: n } : i)))
  }

  function remover(materialId: string) {
    setItens((atuais) => atuais.filter((i) => i.materialId !== materialId))
  }

  function salvar() {
    if (itens.length === 0) return
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

  const total = itens.reduce(
    (s, i) => s + (i.precoEstimado != null ? i.precoEstimado * i.quantidadeSugerida : 0),
    0,
  )
  const invalidos = itens.filter((i) => !(i.quantidadeSugerida > 0))

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-medium">Nova solicitação de compra</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque um material para adicionar à mão, gere uma sugestão automática do que está
          abaixo do mínimo, ou os dois — tudo entra na mesma lista, e dá para editar qualquer
          quantidade antes de salvar.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div ref={buscaRef} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Adicionar material pelo nome ou código…" data-testid="buscar-material"
            className={`${CAMPO} pl-9`}
          />
          {busca.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
              {pesquisando ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Procurando…</p>
              ) : resultados.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum material ativo encontrado.</p>
              ) : (
                <ul data-testid="resultados-busca-material">
                  {resultados.map((m) => (
                    <li key={m.materialId}>
                      <button
                        type="button" onClick={() => adicionarItem(m)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span>
                          <span className="font-medium">{m.nome}</span>
                          <span className="ml-2 text-xs tabular text-muted-foreground">{m.codigo}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular text-muted-foreground">
                          {m.saldo} / {m.estoqueMinimo || '—'} {m.unidade}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          type="button" onClick={sugerir} disabled={sugerindo} data-testid="gerar-sugestao"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium
                     transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Sparkles className="size-4" /> {sugerindo ? 'Consultando o estoque…' : 'Gerar sugestão automática'}
        </button>
      </div>

      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum item ainda. Busque um material acima ou gere uma sugestão automática.
        </p>
      ) : (
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
      )}

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
