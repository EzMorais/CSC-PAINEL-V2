import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Filtros } from '@/components/locacoes/filtros'
import { PainelLocacoes } from '@/components/locacoes/painel-locacoes'
import { listarLocacoes, opcoesDeFiltro } from '@/queries/locacoes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Locações — Painel SC' }

export default async function LocacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const [itens, opcoes] = await Promise.all([
    listarLocacoes({
      busca: sp.busca,
      obraId: sp.obraId,
      fornecedorId: sp.fornecedorId,
      status: sp.status,
      estado: sp.estado,
      aConfirmar: sp.aConfirmar === '1',
    }),
    opcoesDeFiltro(),
  ])

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Locações</h1>
          <p className="text-sm text-muted-foreground" data-testid="contagem">
            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          </p>
        </div>
        <Link href="/locacoes/nova"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Plus className="size-4" /> Nova locação
        </Link>
      </header>

      <Filtros obras={opcoes.obras} fornecedores={opcoes.fornecedores} />
      <PainelLocacoes itens={itens} obras={opcoes.obras} itemInicial={sp.item} />
    </div>
  )
}
