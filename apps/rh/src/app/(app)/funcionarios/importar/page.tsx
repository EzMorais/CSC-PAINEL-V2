import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirLancamento } from '@/lib/auth'
import { ImportarPlanilha } from '@/components/funcionarios/importar-planilha'

export const metadata = { title: 'Importar funcionários — RH' }
export const dynamic = 'force-dynamic'

export default async function ImportarPage() {
  await exigirLancamento()

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <Link href="/funcionarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Funcionários
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Importar por planilha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastra vários funcionários de uma vez, a partir do Excel que o RH já usa
        </p>
      </header>

      <ImportarPlanilha />

      <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Quem já está no RH é <strong>pulado</strong>, nunca sobrescrito — reimportar uma
        planilha antiga por engano não apaga telefone, foto e endereço que alguém atualizou
        à mão. Para corrigir dados de quem já existe, abra a ficha da pessoa.
      </p>
    </div>
  )
}
