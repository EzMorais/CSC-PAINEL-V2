import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { FormProgramacao } from '@/components/programacao/form-programacao'
import { exigirSessao } from '@/lib/auth'
import { hojeUtc } from '@/queries/dashboard'

export const metadata = { title: 'Nova programação' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ data?: string }> }

export default async function NovaProgramacaoPage({ searchParams }: Props) {
  await exigirSessao()
  const { data } = await searchParams

  const alojamentos = await prisma.alojamento.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  })

  const inicial = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hojeUtc().toISOString().slice(0, 10)

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/programacao" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Programação
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nova programação</h1>
      </header>

      <FormProgramacao alojamentos={alojamentos} dataInicial={inicial} />
    </div>
  )
}
