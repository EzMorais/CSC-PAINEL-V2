import { AlertTriangle } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { FormNc } from '@/components/nao-conformidades/form-nc'
import { ListaNc } from '@/components/nao-conformidades/lista-nc'
import { contarNaoConformidadesAbertas, contarNaoConformidadesVencidas, listarNaoConformidades } from '@/queries/nao-conformidades'

export const metadata = { title: 'Não Conformidades — RH e SST' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string; status?: string; gravidade?: string }> }

export default async function NaoConformidadesPage({ searchParams }: Props) {
  const filtros = await searchParams
  const [naoConformidades, abertas, vencidas] = await Promise.all([
    listarNaoConformidades(filtros),
    contarNaoConformidadesAbertas(),
    contarNaoConformidadesVencidas(),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Não Conformidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">Registro, tratativa e evidências</p>
        </div>
        <FormNc />
      </header>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Em aberto" valor={String(abertas)}
          tom={abertas > 0 ? 'atencao' : 'neutro'}
          icone={<AlertTriangle className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          rotulo="Com prazo vencido" valor={String(vencidas)}
          tom={vencidas > 0 ? 'vencida' : 'neutro'}
          icone={<AlertTriangle className="size-4 text-muted-foreground" />}
        />
      </section>

      <ListaNc linhas={naoConformidades} />
    </div>
  )
}
