import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ListaPedidos } from '@/components/pedidos/lista-pedidos'
import { listarAlojamentos } from '@/queries/alojamentos'
import { ROTULO_STATUS_PEDIDO, ROTULO_TIPO_PEDIDO, STATUS_PEDIDO, TIPO_PEDIDO } from '@/lib/dominio/constantes'

export const metadata = { title: 'Pedidos' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ status?: string; tipo?: string; alojamentoId?: string }> }

const FILTRO = 'rounded-md border border-input bg-background px-3 py-2 text-sm'

export default async function PedidosPage({ searchParams }: Props) {
  const f = await searchParams
  const status = f.status ?? 'ABERTOS'

  const [pedidos, alojamentos] = await Promise.all([
    prisma.pedido.findMany({
      where: {
        ...(status === 'ABERTOS'
          ? { status: { in: [STATUS_PEDIDO.ABERTO, STATUS_PEDIDO.EM_ANDAMENTO] } }
          : status !== 'TODOS'
            ? { status }
            : {}),
        ...(f.tipo ? { tipo: f.tipo } : {}),
        ...(f.alojamentoId ? { alojamentoId: f.alojamentoId } : {}),
      },
      orderBy: [{ status: 'asc' }, { prioridade: 'desc' }, { criadoEm: 'desc' }],
      include: { alojamento: { select: { nome: true } } },
    }),
    listarAlojamentos(),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Material de limpeza, manutenção e pedidos pessoais dos moradores
          </p>
        </div>
        <Link
          href="/pedidos/novo" data-testid="novo-pedido"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="size-4" /> Novo pedido
        </Link>
      </header>

      <form className="flex flex-wrap gap-2">
        <select name="status" defaultValue={status} className={FILTRO}>
          <option value="ABERTOS">Em aberto</option>
          {Object.values(STATUS_PEDIDO).map((s) => (
            <option key={s} value={s}>{ROTULO_STATUS_PEDIDO[s]}</option>
          ))}
          <option value="TODOS">Todos</option>
        </select>
        <select name="tipo" defaultValue={f.tipo ?? ''} className={FILTRO}>
          <option value="">Todos os tipos</option>
          {Object.values(TIPO_PEDIDO).map((t) => (
            <option key={t} value={t}>{ROTULO_TIPO_PEDIDO[t]}</option>
          ))}
        </select>
        <select name="alojamentoId" defaultValue={f.alojamentoId ?? ''} className={FILTRO}>
          <option value="">Todos os alojamentos</option>
          {alojamentos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <button type="submit" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          Filtrar
        </button>
      </form>

      <ListaPedidos pedidos={pedidos} />
    </div>
  )
}
