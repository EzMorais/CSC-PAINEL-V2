'use client'

import { calcularStatus, rotuloVencimento } from '@/lib/dominio/status'
import { brl, dataBR } from '@/lib/dominio/formato'
import { valorTotal } from '@/lib/dominio/periodo'
import type { LocacaoListada } from '@/queries/locacoes'

const CLASSE_STATUS: Record<string, string> = {
  VENCIDA: 'bg-status-vencida/10 text-status-vencida',
  ATENCAO: 'bg-status-atencao/10 text-status-atencao',
  ATIVA: 'bg-status-ativa/10 text-status-ativa',
  DEVOLVIDA: 'bg-muted text-muted-foreground',
  SEM_PRAZO: 'bg-muted text-muted-foreground',
}

/**
 * No nível do módulo, não dentro de TabelaLocacoes: um componente declarado no corpo de
 * outro é recriado a cada render, e o React o trata como um tipo novo — desmonta a
 * subárvore e remonta do zero. Só depende da prop `item` e das constantes do módulo.
 */
function Etiqueta({ item }: { item: LocacaoListada }) {
  const status = calcularStatus({ dataFim: item.dataFim, devolvidaEm: item.devolvidaEm })
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${CLASSE_STATUS[status]}`}>
      {item.devolvidaEm ? `devolvida ${dataBR(item.devolvidaEm)}` : rotuloVencimento(item.dataFim)}
    </span>
  )
}

type Props = {
  itens: LocacaoListada[]
  selecionados: Set<string>
  aoSelecionar: (id: string, marcado: boolean) => void
  aoAbrir: (id: string) => void
}

export function TabelaLocacoes({ itens, selecionados, aoSelecionar, aoAbrir }: Props) {
  if (!itens.length) {
    return (
      <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Nenhuma locação encontrada com esses filtros.
      </p>
    )
  }

  return (
    <>
      {/* Cards — mobile */}
      <ul data-testid="lista-cards" className="space-y-2 lg:hidden">
        {itens.map((i) => (
          <li key={i.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox" checked={selecionados.has(i.id)}
                onChange={(e) => aoSelecionar(i.id, e.target.checked)}
                aria-label={`Selecionar ${i.descricao}`} className="mt-1 size-4"
              />
              <button type="button" onClick={() => aoAbrir(i.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium">{i.descricao}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {i.obra.codigo} · {i.fornecedor?.nome ?? 'sem fornecedor'}
                  {i.trCodigo ? ` · Tr ${i.trCodigo}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Etiqueta item={i} />
                  {i.estado === 'PERDIDO' && (
                    <span className="rounded bg-status-perdido/10 px-1.5 py-0.5 text-xs font-medium text-status-perdido">
                      perdido
                    </span>
                  )}
                  {i.obraAConfirmar && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      obra a confirmar
                    </span>
                  )}
                  <span className="ml-auto text-xs tabular text-muted-foreground">
                    {brl(valorTotal(i.valorItem, i.dataInicio, i.dataFim))}
                  </span>
                </div>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Tabela — desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table data-testid="tabela-locacoes" className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8 py-2" />
              <th className="py-2 pr-4 font-medium">Equipamento</th>
              <th className="py-2 pr-4 font-medium">Obra</th>
              <th className="py-2 pr-4 font-medium">Fornecedor</th>
              <th className="py-2 pr-4 font-medium">Início</th>
              <th className="py-2 pr-4 font-medium">Fim</th>
              <th className="py-2 pr-4 font-medium">Situação</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className="border-b border-border/50 hover:bg-accent/50">
                <td className="py-2">
                  <input
                    type="checkbox" checked={selecionados.has(i.id)}
                    onChange={(e) => aoSelecionar(i.id, e.target.checked)}
                    aria-label={`Selecionar ${i.descricao}`} className="size-4"
                  />
                </td>
                <td className="py-2 pr-4">
                  <button type="button" onClick={() => aoAbrir(i.id)} className="text-left font-medium hover:underline">
                    {i.descricao}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {i.trCodigo ? `Tr ${i.trCodigo}` : '—'}
                    {i.quantidade > 1 ? ` · ${i.quantidade} un` : ''}
                    {i.estado === 'PERDIDO' ? ' · perdido' : ''}
                    {i.obraAConfirmar ? ' · obra a confirmar' : ''}
                  </p>
                </td>
                <td className="py-2 pr-4 text-xs text-muted-foreground">{i.obra.codigo}</td>
                <td className="py-2 pr-4 text-xs text-muted-foreground">{i.fornecedor?.nome ?? '—'}</td>
                <td className="py-2 pr-4 tabular text-xs">{dataBR(i.dataInicio)}</td>
                <td className="py-2 pr-4 tabular text-xs">{dataBR(i.dataFim)}</td>
                <td className="py-2 pr-4"><Etiqueta item={i} /></td>
                <td className="py-2 text-right tabular text-xs">
                  {brl(valorTotal(i.valorItem, i.dataInicio, i.dataFim))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
