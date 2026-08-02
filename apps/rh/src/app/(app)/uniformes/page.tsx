import { Shirt } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { FormEntrega } from '@/components/uniformes/form-entrega'
import { ListaEntregas } from '@/components/uniformes/lista-entregas'
import { contarSemEntrega, funcionariosParaEntrega, listarEntregas } from '@/queries/uniformes'

export const metadata = { title: 'Uniformes — RH e SST' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string; peca?: string }> }

export default async function UniformesPage({ searchParams }: Props) {
  const filtros = await searchParams
  const [entregas, funcionarios, semEntrega] = await Promise.all([
    listarEntregas(filtros),
    funcionariosParaEntrega(),
    contarSemEntrega(),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Uniformes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entrega, troca e reposição</p>
        </div>
        <FormEntrega funcionarios={funcionarios} />
      </header>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Sem entrega registrada"
          valor={String(semEntrega)}
          tom={semEntrega > 0 ? 'atencao' : 'neutro'}
          detalhe={semEntrega > 0 ? 'Ativos, afastados ou em férias sem nenhuma peça entregue' : 'Todo mundo já recebeu ao menos uma peça'}
          icone={<Shirt className="size-4 text-muted-foreground" />}
        />
      </section>

      <ListaEntregas linhas={entregas} />
    </div>
  )
}
