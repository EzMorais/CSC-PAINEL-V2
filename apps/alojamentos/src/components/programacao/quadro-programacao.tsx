'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { excluirProgramacao } from '@/actions/programacao'
import { SeloTipoProgramacao } from '@/components/selo'

export type ItemProgramacao = {
  id: string
  tipo: string
  titulo: string
  descricao: string | null
  horario: string | null
  responsavelNome: string | null
  alojamento: { nome: string } | null
}

function Linha({ item }: { item: ItemProgramacao }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, iniciar] = useTransition()

  function excluir() {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(excluirProgramacao(item.id))
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-3 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {item.horario && <span className="tabular text-muted-foreground">{item.horario}</span>}
          {item.titulo}
          <SeloTipoProgramacao tipo={item.tipo} />
        </p>
        <p className="text-xs text-muted-foreground">
          {item.alojamento?.nome ?? 'Todos os alojamentos'}
          {item.responsavelNome && <> · responsável: {item.responsavelNome}</>}
        </p>
        {item.descricao && <p className="mt-1 text-sm text-muted-foreground">{item.descricao}</p>}
        {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {confirmando ? (
          <>
            <button
              type="button" onClick={excluir} disabled={pendente}
              className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50"
            >
              {pendente ? 'Excluindo…' : 'Confirmar'}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="rounded-md border border-border px-2.5 py-1 text-xs">
              Não
            </button>
          </>
        ) : (
          <button
            type="button" onClick={() => setConfirmando(true)}
            aria-label={`Excluir ${item.titulo}`} data-testid={`excluir-${item.id}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </li>
  )
}

export function QuadroProgramacao({ itens }: { itens: ItemProgramacao[] }) {
  if (itens.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nada programado para este dia.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm shadow-sm" data-testid="quadro-programacao">
      {itens.map((i) => <Linha key={i.id} item={i} />)}
    </ul>
  )
}
