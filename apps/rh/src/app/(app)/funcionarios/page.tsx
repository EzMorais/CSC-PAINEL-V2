import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ListaFuncionarios } from '@/components/funcionarios/lista-funcionarios'
import { listarFuncionarios } from '@/queries/funcionarios'

export const metadata = { title: 'Funcionários — RH e SST' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string; status?: string; obraId?: string; cargoId?: string }> }

export default async function FuncionariosPage({ searchParams }: Props) {
  const filtros = await searchParams
  const funcionarios = await listarFuncionarios(filtros)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Funcionários</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastro, lotação e histórico</p>
        </div>
        <Link
          href="/funcionarios/novo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="size-4" /> Novo funcionário
        </Link>
      </header>

      <ListaFuncionarios linhas={funcionarios} />
    </div>
  )
}
