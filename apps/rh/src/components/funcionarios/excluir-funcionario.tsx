'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Trash2, TriangleAlert } from 'lucide-react'
import { excluirFuncionario, vinculosDoFuncionario, type Vinculos } from '@/actions/funcionarios'

/**
 * Excluir de vez o cadastro de um funcionário.
 *
 * Em duas etapas de propósito: o primeiro clique só CONSULTA o que está pendurado na pessoa
 * e mostra na tela. Quem apaga precisa ver, antes de confirmar, que ali havia trinta
 * entregas de EPI — que é justamente o caso em que não se deve apagar.
 *
 * A trava de verdade está na server action; isto aqui é a explicação.
 */
export function ExcluirFuncionario({ id, nome }: { id: string; nome: string }) {
  const router = useRouter()
  const [vinculos, setVinculos] = useState<Vinculos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()

  function abrir() {
    setErro(null)
    iniciar(async () => {
      const r = await vinculosDoFuncionario(id)
      if (!r.ok) return setErro(r.erro)
      setVinculos(r.dados)
      setAberto(true)
    })
  }

  function confirmar() {
    setErro(null)
    iniciar(async () => {
      const r = await excluirFuncionario(id)
      if (!r.ok) return setErro(r.erro)
      router.push('/funcionarios')
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <div className="space-y-2">
        <button
          type="button" onClick={abrir} disabled={pendente} data-testid="excluir-funcionario"
          className="inline-flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="size-4" /> {pendente ? 'Conferindo…' : 'Excluir cadastro'}
        </button>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      </div>
    )
  }

  const podeApagar = (vinculos?.total ?? 0) === 0
  const linhas = vinculos
    ? [
        ['Entregas de EPI', vinculos.entregasEpi],
        ['Entregas de uniforme', vinculos.entregasUniforme],
        ['Exames', vinculos.exames],
        ['Treinamentos', vinculos.treinamentos],
        ['Documentos', vinculos.documentos],
      ].filter(([, n]) => (n as number) > 0)
    : []

  return (
    <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
      <p className="flex items-start gap-2 text-sm font-medium">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        Excluir o cadastro de {nome}?
      </p>

      {podeApagar ? (
        <p className="text-sm text-muted-foreground">
          Não há entrega de EPI, exame, treinamento nem documento no nome desta pessoa —
          nada de prova se perde. A linha do tempo e os dependentes vão junto, e isso não
          tem volta.
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Não dá para excluir: esta pessoa tem registros que são a prova de que a empresa
            cumpriu o que a lei exige.
          </p>
          <ul className="space-y-0.5 text-muted-foreground">
            {linhas.map(([rotulo, n]) => (
              <li key={String(rotulo)} className="flex justify-between border-b border-border/50 pb-0.5">
                <span>{rotulo}</span>
                <span className="tabular font-medium text-foreground">{String(n)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            O que a situação pede é registrar o <strong>desligamento</strong>: mude a
            situação para “Desligado” no formulário acima. A pessoa sai das listas e o que
            ela recebeu continua provado.
          </p>
        </div>
      )}

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        {podeApagar && (
          <button
            type="button" onClick={confirmar} disabled={pendente} data-testid="confirmar-exclusao"
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
          >
            {pendente ? 'Excluindo…' : 'Excluir mesmo assim'}
          </button>
        )}
        <button
          type="button" onClick={() => { setAberto(false); setErro(null) }}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          {podeApagar ? 'Cancelar' : 'Entendi'}
        </button>
      </div>
    </div>
  )
}
