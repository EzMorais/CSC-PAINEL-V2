'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { carregarLocacao } from '@/actions/locacoes'
import { brl, dataBR } from '@/lib/dominio/formato'
import { valorTotal, duracaoEmDias, periodoPorDias } from '@/lib/dominio/periodo'
import { calcularStatus, rotuloVencimento } from '@/lib/dominio/status'
import { ROTULO_STATUS } from '@/lib/dominio/constantes'

type Detalhe = NonNullable<Awaited<ReturnType<typeof carregarLocacao>>>

/**
 * Forma nomeada (`text-status-vencida`), não a de colchete cru: com o colchete o elemento
 * herda o foreground e a etiqueta sai preta, sem erro no console.
 */
const CLASSE_STATUS: Record<string, string> = {
  VENCIDA: 'text-status-vencida',
  ATENCAO: 'text-status-atencao',
  ATIVA: 'text-status-ativa',
  DEVOLVIDA: 'text-status-devolvida',
  SEM_PRAZO: 'text-muted-foreground',
}

type Props = {
  id: string | null
  aoFechar: () => void
  aoAgir: (acao: 'editar' | 'renovar' | 'devolver' | 'transferir', detalhe: Detalhe) => void
}

export function DrawerLocacao({ id, aoFechar, aoAgir }: Props) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [aba, setAba] = useState<'dados' | 'historico'>('dados')
  const [idExibido, setIdExibido] = useState<string | null>(id)

  // Ajuste durante o render, não dentro de um efeito: zerar em efeito pintaria um quadro
  // com o detalhe do item anterior sob o cabeçalho do novo. Padrão "state derivado de prop".
  if (id !== idExibido) {
    setIdExibido(id)
    setDetalhe(null)
    setAba('dados')
  }

  useEffect(() => {
    if (!id) return
    let vivo = true
    carregarLocacao(id).then((d) => { if (vivo) setDetalhe(d) })
    return () => { vivo = false }
  }, [id])

  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [aoFechar])

  if (!id) return null

  const status = detalhe ? calcularStatus({ dataFim: detalhe.dataFim, devolvidaEm: detalhe.devolvidaEm }) : null
  const dias = detalhe ? duracaoEmDias(detalhe.dataInicio, detalhe.dataFim) : 0

  const linhas: [string, ReactNode][] = detalhe
    ? [
        [
          'Situação',
          <span key="s" className={status ? CLASSE_STATUS[status] : undefined}>
            {status ? ROTULO_STATUS[status] : '—'}
          </span>,
        ],
        ['Vencimento', detalhe.devolvidaEm ? `devolvida em ${dataBR(detalhe.devolvidaEm)}` : rotuloVencimento(detalhe.dataFim)],
        ['Período', `${dataBR(detalhe.dataInicio)} a ${dataBR(detalhe.dataFim)}`],
        ['Duração', dias ? `${dias} dias · ${periodoPorDias(dias)}` : '—'],
        ['Fornecedor', detalhe.fornecedor ? `${detalhe.fornecedor.nome}${detalhe.fornecedor.telefone ? ` · ${detalhe.fornecedor.telefone}` : ''}` : '—'],
        ['Quantidade', String(detalhe.quantidade)],
        ['Estado do item', detalhe.estado],
        ['Valor do item', brl(detalhe.valorItem)],
        ['Valor total', brl(valorTotal(detalhe.valorItem, detalhe.dataInicio, detalhe.dataFim))],
        ['Observações', detalhe.observacoes ?? '—'],
      ]
    : []

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={aoFechar} aria-hidden />
      <aside
        role="dialog" aria-modal="true" aria-label="Detalhes da locação" data-testid="drawer-locacao"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card sm:max-w-md"
      >
        {!detalhe ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{detalhe.descricao}</h2>
                <p className="text-xs text-muted-foreground">
                  {detalhe.obra.cliente} · {detalhe.obra.codigo}
                  {detalhe.trCodigo ? ` · Tr ${detalhe.trCodigo}` : ''}
                </p>
              </div>
              <button type="button" onClick={aoFechar} aria-label="Fechar"
                      className="grid size-8 shrink-0 place-items-center rounded-md border border-border">
                <X className="size-4" />
              </button>
            </header>

            <div className="flex border-b border-border" role="tablist">
              {(['dados', 'historico'] as const).map((a) => (
                <button
                  key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium ${
                    aba === a ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {a === 'dados' ? 'Dados' : `Histórico (${detalhe.movimentacoes.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {aba === 'dados' ? (
                <dl className="space-y-3 text-sm">
                  {linhas.map(([rotulo, valor]) => (
                    <div key={rotulo} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                      <dt className="text-muted-foreground">{rotulo}</dt>
                      <dd className="text-right font-medium">{valor}</dd>
                    </div>
                  ))}
                  {detalhe.obraAConfirmar && (
                    <p className="rounded-md border border-amber-600/50 bg-amber-600/10 p-3 text-xs">
                      Obra a confirmar: este item veio de uma aba compartilhada por mais de uma obra.
                      Use Transferir para definir a obra correta.
                    </p>
                  )}
                </dl>
              ) : (
                <ol data-testid="historico" className="space-y-3">
                  {detalhe.movimentacoes.map((m) => (
                    <li key={m.id} className="border-l-2 border-border pl-3">
                      <p className="text-sm">{m.descricaoHumana}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.tipo.toLowerCase()} · {dataBR(m.criadoEm)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {!detalhe.devolvidaEm && (
              <footer className="grid grid-cols-2 gap-2 border-t border-border p-4">
                <button type="button" onClick={() => aoAgir('editar', detalhe)}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Editar</button>
                <button type="button" onClick={() => aoAgir('renovar', detalhe)}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Renovar</button>
                <button type="button" onClick={() => aoAgir('transferir', detalhe)}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Transferir</button>
                <button type="button" onClick={() => aoAgir('devolver', detalhe)}
                        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Devolver</button>
              </footer>
            )}
          </>
        )}
      </aside>
    </>
  )
}
