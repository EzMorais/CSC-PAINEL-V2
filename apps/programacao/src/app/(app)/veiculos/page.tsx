import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirSessao } from '@/lib/auth'
import { podeLancar } from '@/lib/dominio/cargos'
import { prisma } from '@/lib/prisma'
import { ListaVeiculos } from '@/components/veiculos/lista-veiculos'

export const metadata = { title: 'Veículos — Programação' }
export const dynamic = 'force-dynamic'

export default async function VeiculosPage() {
  const sessao = await exigirSessao()

  const veiculos = await prisma.veiculo.findMany({
    orderBy: { modelo: 'asc' },
    include: { _count: { select: { recursos: true } } },
  })

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex items-start gap-3">
        <Link href="/" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Veículos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro fixo de quem não vem da Frota — alugados ou de terceiro
          </p>
        </div>
      </header>

      <ListaVeiculos
        podeEditar={podeLancar(sessao.cargo)}
        veiculos={veiculos.map((v) => ({
          id: v.id, modelo: v.modelo, placa: v.placa, motoristaNome: v.motoristaNome,
          foto: v.foto, ativo: v.ativo, usos: v._count.recursos,
        }))}
      />
    </div>
  )
}
