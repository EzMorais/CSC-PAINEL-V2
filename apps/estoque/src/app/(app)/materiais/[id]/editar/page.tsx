import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { FormMaterial } from '@/components/materiais/form-material'
import { obterMaterial } from '@/queries/materiais'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export const metadata = { title: 'Editar material — Almoxarifado' }

export default async function EditarMaterialPage({ params }: Props) {
  const { id } = await params
  const material = await obterMaterial(id)
  if (!material) notFound()

  const valores: Record<string, string> = {
    nome: material.nome,
    categoria: material.categoria,
    unidade: material.unidade,
    estoqueMinimo: material.estoqueMinimo ? String(material.estoqueMinimo) : '',
    localizacao: material.localizacao ?? '',
    observacao: material.observacao ?? '',
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href={`/materiais/${material.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {material.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Editar material</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O saldo não é editado aqui — ele vem das movimentações. Para acertar a quantidade,
          use a contagem física na tela do material.
        </p>
      </header>

      <FormMaterial id={material.id} codigo={material.codigo} valores={valores} />
    </div>
  )
}
