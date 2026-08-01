'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TabelaLocacoes } from './tabela-locacoes'
import { DrawerLocacao } from './drawer-locacao'
import { DialogAcao, type Acao } from './dialog-acao'
import { AcoesLote } from './acoes-lote'
import type { LocacaoListada } from '@/queries/locacoes'

type Props = {
  itens: LocacaoListada[]
  obras: { id: string; codigo: string; cliente: string }[]
  itemInicial?: string
}

export function PainelLocacoes({ itens, obras, itemInicial }: Props) {
  const router = useRouter()
  const [aberto, setAberto] = useState<string | null>(itemInicial ?? null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [acao, setAcao] = useState<{ tipo: Acao; id: string } | null>(null)

  function selecionar(id: string, marcado: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (marcado) novo.add(id)
      else novo.delete(id)
      return novo
    })
  }

  function concluido() {
    setAcao(null)
    setAberto(null)
    setSelecionados(new Set())
    router.refresh()
  }

  return (
    <>
      {selecionados.size > 0 && (
        <AcoesLote
          ids={[...selecionados]} obras={obras}
          aoLimpar={() => setSelecionados(new Set())}
          aoConcluir={concluido}
        />
      )}

      <TabelaLocacoes
        itens={itens} selecionados={selecionados}
        aoSelecionar={selecionar} aoAbrir={setAberto}
      />

      <DrawerLocacao
        id={aberto} aoFechar={() => setAberto(null)}
        aoAgir={(tipo, detalhe) => setAcao({ tipo, id: detalhe.id })}
      />

      {acao && (
        <DialogAcao
          acao={acao.tipo} locacaoId={acao.id} obras={obras}
          aoFechar={() => setAcao(null)} aoConcluir={concluido}
        />
      )}
    </>
  )
}
