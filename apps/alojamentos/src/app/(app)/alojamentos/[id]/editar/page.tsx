import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { FormAlojamento } from '@/components/alojamentos/form-alojamento'
import { exigirSessao } from '@/lib/auth'
import { mapaConfigurado } from '@/lib/geo'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function EditarAlojamentoPage({ params }: Props) {
  await exigirSessao()
  const { id } = await params
  const a = await prisma.alojamento.findUnique({ where: { id } })
  if (!a) notFound()

  const valores: Record<string, string> = {
    nome: a.nome,
    cep: a.cep ?? '',
    logradouro: a.logradouro ?? '',
    numero: a.numero ?? '',
    complemento: a.complemento ?? '',
    bairro: a.bairro ?? '',
    cidade: a.cidade ?? '',
    uf: a.uf ?? '',
    capacidadeTotal: a.capacidadeTotal != null ? String(a.capacidadeTotal) : '',
    responsavelNome: a.responsavelNome ?? '',
    telefoneResponsavel: a.telefoneResponsavel ?? '',
    foto: a.foto ?? '',
    observacoes: a.observacoes ?? '',
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href={`/alojamentos/${a.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {a.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Editar alojamento</h1>
      </header>

      <FormAlojamento id={a.id} valores={valores} mapaLigado={mapaConfigurado()} />
    </div>
  )
}
