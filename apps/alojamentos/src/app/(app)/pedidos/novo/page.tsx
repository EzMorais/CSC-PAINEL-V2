import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { FormPedido } from '@/components/pedidos/form-pedido'
import { exigirSessao } from '@/lib/auth'
import { STATUS_ALOCACAO } from '@/lib/dominio/constantes'

export const metadata = { title: 'Novo pedido' }
export const dynamic = 'force-dynamic'

export default async function NovoPedidoPage() {
  await exigirSessao()

  const [alojamentos, alocacoes] = await Promise.all([
    prisma.alojamento.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    prisma.alocacao.findMany({
      where: { status: STATUS_ALOCACAO.ATIVA },
      orderBy: { funcionarioNome: 'asc' },
      select: { id: true, funcionarioNome: true, alojamentoId: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/pedidos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Pedidos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Novo pedido</h1>
      </header>

      <FormPedido
        alojamentos={alojamentos}
        moradores={alocacoes.map((a) => ({ id: a.id, nome: a.funcionarioNome, alojamentoId: a.alojamentoId }))}
      />
    </div>
  )
}
