import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormMaterial } from '@/components/materiais/form-material'
import { proximoCodigo } from '@/queries/materiais'

export const metadata = { title: 'Novo material — Almoxarifado' }
export const dynamic = 'force-dynamic'

export default async function NovoMaterialPage() {
  const codigo = await proximoCodigo()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/materiais" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Materiais
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Novo material</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O saldo começa em zero — quem cria estoque é a movimentação de entrada.
        </p>
      </header>

      <FormMaterial id={null} codigo={codigo} />
    </div>
  )
}
