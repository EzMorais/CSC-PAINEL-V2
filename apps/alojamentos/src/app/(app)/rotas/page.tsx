import { prisma } from '@/lib/prisma'
import { ListaRotas } from '@/components/cadastros/lista-rotas'
import { STATUS_ALOCACAO } from '@/lib/dominio/constantes'

export const metadata = { title: 'Ônibus' }
export const dynamic = 'force-dynamic'

export default async function RotasPage() {
  const rotas = await prisma.rotaOnibus.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: { _count: { select: { alocacoes: { where: { status: STATUS_ALOCACAO.ATIVA } } } } },
  })

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Ônibus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          As rotas fretadas que levam a equipe do alojamento até a obra
        </p>
      </header>

      <ListaRotas
        rotas={rotas.map((r) => ({
          id: r.id, nome: r.nome, motorista: r.motorista, veiculo: r.veiculo,
          horarioIda: r.horarioIda, horarioVolta: r.horarioVolta, capacidade: r.capacidade,
          obraCodigo: r.obraCodigo, ativo: r.ativo, passageiros: r._count.alocacoes,
        }))}
      />
    </div>
  )
}
