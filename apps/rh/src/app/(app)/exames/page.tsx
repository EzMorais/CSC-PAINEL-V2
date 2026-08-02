import { Stethoscope } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { FormExame } from '@/components/exames/form-exame'
import { ListaExames } from '@/components/exames/lista-exames'
import { contarAlertasExame, funcionariosParaExame, listarExames } from '@/queries/exames'

export const metadata = { title: 'Exames — RH e SST' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string; tipo?: string }> }

export default async function ExamesPage({ searchParams }: Props) {
  const filtros = await searchParams
  const [exames, funcionarios, alertas] = await Promise.all([
    listarExames(filtros),
    funcionariosParaExame(),
    contarAlertasExame(),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Exames</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agenda e histórico de ASO</p>
        </div>
        <FormExame funcionarios={funcionarios} />
      </header>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="ASO vencido" valor={String(alertas.vencidos)}
          tom={alertas.vencidos > 0 ? 'vencida' : 'neutro'}
          icone={<Stethoscope className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          rotulo="Vencendo em 30 dias" valor={String(alertas.vencendo)}
          tom={alertas.vencendo > 0 ? 'atencao' : 'neutro'}
          icone={<Stethoscope className="size-4 text-muted-foreground" />}
        />
        <KpiCard rotulo="Exames registrados" valor={String(exames.length)} />
      </section>

      <ListaExames linhas={exames} />
    </div>
  )
}
