import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormFuncionario } from '@/components/funcionarios/form-funcionario'
import { opcoes, proximaMatricula } from '@/queries/funcionarios'

export const metadata = { title: 'Novo funcionário — RH e SST' }
export const dynamic = 'force-dynamic'

export default async function NovoFuncionarioPage() {
  const [listas, matricula] = await Promise.all([opcoes(), proximaMatricula()])

  // Data de hoje em UTC: o formulário trabalha em dia de calendário, e `toISOString`
  // sobre a data local adiantaria o dia depois das 21h no horário de Brasília.
  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/funcionarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Funcionários
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Novo funcionário</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Só nome, CPF e data de admissão são obrigatórios — o resto pode ser completado depois.
        </p>
      </header>

      <FormFuncionario id={null} matricula={matricula} opcoes={listas} valores={{ admitidoEm: hoje }} />
    </div>
  )
}
