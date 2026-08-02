import { FormMovimentacao } from '@/components/movimentacoes/form-movimentacao'
import { ListaMovimentacoes } from '@/components/movimentacoes/lista-movimentacoes'
import { FichasPendentes } from '@/components/movimentacoes/fichas-pendentes'
import { listarFichasPendentes, listarMovimentacoes, listarObras } from '@/queries/movimentacoes'
import { opcoes } from '@/queries/materiais'
import { listarFuncionariosDoRh } from '@/lib/cliente-rh'

export const metadata = { title: 'Movimentações — Almoxarifado' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string; tipo?: string; obraId?: string }> }

export default async function MovimentacoesPage({ searchParams }: Props) {
  const filtros = await searchParams
  const [movimentacoes, listas, obras, pendentes, respostaRh] = await Promise.all([
    listarMovimentacoes(filtros),
    opcoes(),
    listarObras(),
    listarFichasPendentes(),
    // O RH fora do ar não pode derrubar esta tela: só a saída de EPI depende dele, e o
    // formulário avisa quando a lista não veio.
    listarFuncionariosDoRh(),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Movimentações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entradas, saídas e ajustes — o histórico que forma o saldo
          </p>
        </div>
        <FormMovimentacao
          opcoes={listas}
          funcionarios={respostaRh.ok ? respostaRh.dados : []}
          erroRh={respostaRh.ok ? null : respostaRh.erro}
        />
      </header>

      <FichasPendentes fichas={pendentes} />

      <ListaMovimentacoes linhas={movimentacoes} obras={obras} />
    </div>
  )
}
