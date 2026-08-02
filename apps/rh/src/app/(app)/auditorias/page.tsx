import { FormAuditoria } from '@/components/auditorias/form-auditoria'
import { ListaAuditorias } from '@/components/auditorias/lista-auditorias'
import { listarAuditorias, obrasParaSelecao } from '@/queries/auditorias'

export const metadata = { title: 'Auditorias — RH e SST' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string }> }

export default async function AuditoriasPage({ searchParams }: Props) {
  const filtros = await searchParams
  const [auditorias, obras] = await Promise.all([listarAuditorias(filtros), obrasParaSelecao()])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Auditorias</h1>
          <p className="mt-1 text-sm text-muted-foreground">Checklists de campo e planos de ação</p>
        </div>
        <FormAuditoria obras={obras} />
      </header>

      <ListaAuditorias linhas={auditorias} />
    </div>
  )
}
