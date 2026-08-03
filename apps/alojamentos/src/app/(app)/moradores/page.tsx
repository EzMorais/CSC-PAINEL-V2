import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ListaMoradores } from '@/components/moradores/lista-moradores'
import { listarAlocacoes } from '@/queries/moradores'
import { listarAlojamentos } from '@/queries/alojamentos'
import { hojeUtc } from '@/queries/dashboard'
import { STATUS_ALOCACAO } from '@/lib/dominio/constantes'

export const metadata = { title: 'Moradores' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ status?: string; alojamentoId?: string; busca?: string }> }

const FILTRO = 'rounded-md border border-input bg-background px-3 py-2 text-sm'

export default async function MoradoresPage({ searchParams }: Props) {
  const filtros = await searchParams
  const status = filtros.status ?? STATUS_ALOCACAO.ATIVA

  const [alocacoes, alojamentos] = await Promise.all([
    listarAlocacoes({ ...filtros, status }),
    listarAlojamentos(),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Moradores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quem mora onde, e como vai para a obra</p>
        </div>
        <Link
          href="/moradores/novo" data-testid="novo-morador"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="size-4" /> Alocar morador
        </Link>
      </header>

      <form className="flex flex-wrap gap-2">
        <input
          name="busca" defaultValue={filtros.busca ?? ''} placeholder="Nome ou matrícula"
          className={`${FILTRO} min-w-48 flex-1`}
        />
        <select name="status" defaultValue={status} className={FILTRO}>
          <option value={STATUS_ALOCACAO.ATIVA}>Morando</option>
          <option value={STATUS_ALOCACAO.ENCERRADA}>Já saíram</option>
          <option value="TODAS">Todos</option>
        </select>
        <select name="alojamentoId" defaultValue={filtros.alojamentoId ?? ''} className={FILTRO}>
          <option value="">Todos os alojamentos</option>
          {alojamentos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <button type="submit" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          Filtrar
        </button>
      </form>

      <ListaMoradores alocacoes={alocacoes} hoje={hojeUtc().toISOString().slice(0, 10)} />
    </div>
  )
}
