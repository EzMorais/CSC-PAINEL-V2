import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirSessao } from '@/lib/auth'
import { podeLancar } from '@/lib/dominio/cargos'
import { prisma } from '@/lib/prisma'
import { ListaFrentes } from '@/components/frentes/lista-frentes'

export const metadata = { title: 'Clientes e frentes — Programação' }
export const dynamic = 'force-dynamic'

export default async function FrentesPage() {
  const sessao = await exigirSessao()

  const frentes = await prisma.frente.findMany({
    orderBy: { ordem: 'asc' },
    include: { _count: { select: { escalas: true, recursos: true } } },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-start gap-3">
        <Link href="/" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Clientes e frentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            As colunas do quadro e da imagem, na ordem em que aparecem
          </p>
        </div>
      </header>

      <ListaFrentes
        podeEditar={podeLancar(sessao.cargo)}
        frentes={frentes.map((f) => ({
          id: f.id, nome: f.nome, cor: f.cor, colunas: f.colunas,
          obraCodigo: f.obraCodigo, ativa: f.ativa,
          usos: f._count.escalas + f._count.recursos,
        }))}
      />
    </div>
  )
}
