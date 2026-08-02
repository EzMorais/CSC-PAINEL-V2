import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ListaMateriais } from '@/components/materiais/lista-materiais'
import { listarMateriaisComSaldo } from '@/queries/saldos'

export const metadata = { title: 'Materiais — Almoxarifado' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string; categoria?: string; situacao?: string }> }

export default async function MateriaisPage({ searchParams }: Props) {
  const filtros = await searchParams
  const materiais = await listarMateriaisComSaldo(filtros)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Materiais</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastro, saldo e ponto de reposição</p>
        </div>
        <Link
          href="/materiais/novo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="size-4" /> Novo material
        </Link>
      </header>

      <ListaMateriais linhas={materiais} />
    </div>
  )
}
