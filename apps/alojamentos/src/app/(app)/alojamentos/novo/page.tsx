import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormAlojamento } from '@/components/alojamentos/form-alojamento'
import { exigirSessao } from '@/lib/auth'
import { mapaConfigurado } from '@/lib/geo'

export const metadata = { title: 'Novo alojamento' }
export const dynamic = 'force-dynamic'

export default async function NovoAlojamentoPage() {
  await exigirSessao()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/alojamentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Alojamentos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Novo alojamento</h1>
      </header>

      <FormAlojamento id={null} mapaLigado={mapaConfigurado()} />
    </div>
  )
}
