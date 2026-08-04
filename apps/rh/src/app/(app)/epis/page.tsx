import Link from 'next/link'
import { HardHat, TriangleAlert, PackageCheck, ExternalLink } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ListaEntregasEpi } from '@/components/epis/lista-entregas-epi'
import { funcionariosSemEpi, indicadoresEpi, listarEntregasEpi } from '@/queries/epis'

export const metadata = { title: 'EPIs — RH e SST' }
export const dynamic = 'force-dynamic'

/** Onde o Almoxarifado responde. Mesmo host, outra porta — a sessão vale nos dois. */
const URL_ESTOQUE = process.env.NEXT_PUBLIC_URL_ESTOQUE ?? 'http://localhost:3003'

type Props = { searchParams: Promise<{ busca?: string }> }

export default async function EpisPage({ searchParams }: Props) {
  const filtros = await searchParams
  const [entregas, kpis, semEpi] = await Promise.all([
    listarEntregasEpi(filtros),
    indicadoresEpi(),
    funcionariosSemEpi(),
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">EPIs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fichas de entrega — o registro que a NR-6 exige
          </p>
        </div>
        <a
          href={`${URL_ESTOQUE}/movimentacoes`}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <ExternalLink className="size-4" /> Entregar EPI no Almoxarifado
        </a>
      </header>

      <div className="rounded-lg border border-dashed border-border p-4">
        <div className="flex items-start gap-3">
          <PackageCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">As entregas chegam aqui sozinhas.</p>
            <p className="mt-1">
              Quem dá baixa no equipamento é o Almoxarifado, e é de lá que a ficha vem — assim
              o saldo do estoque e a ficha do funcionário contam sempre a mesma história. Se o
              RH também lançasse por conta própria, o mesmo capacete poderia sair do estoque e
              ser registrado duas vezes aqui, ou sair sem nunca aparecer na ficha.
            </p>
          </div>
        </div>
      </div>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Sem nenhum EPI" valor={String(kpis.semNenhumEpi)}
          tom={kpis.semNenhumEpi > 0 ? 'atencao' : 'ativa'}
          detalhe={kpis.semNenhumEpi > 0 ? 'Funcionários na ativa que nunca receberam' : 'Todo mundo já recebeu'}
          icone={TriangleAlert}
        />
        <KpiCard
          rotulo="CA vencido na entrega" valor={String(kpis.comCaVencido)}
          tom={kpis.comCaVencido > 0 ? 'vencida' : 'neutro'}
          detalhe="Equipamento entregue com certificado fora da validade"
          icone={HardHat}
        />
        <KpiCard rotulo="Entregas no mês" valor={String(kpis.doMes)} />
        <KpiCard rotulo="Total de entregas" valor={String(kpis.total)} />
      </section>

      {semEpi.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Ainda sem EPI registrado</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Funcionários na ativa sem nenhuma ficha. Cargo de risco no topo.
          </p>
          <ul className="mt-3 space-y-1 text-sm" data-testid="sem-epi">
            {semEpi
              .slice()
              .sort((a, b) => {
                const risco = (c: typeof a) => (c.cargo?.risco && c.cargo.risco !== 'NORMAL' ? 0 : 1)
                return risco(a) - risco(b)
              })
              .map((f) => (
                <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
                  <Link href={`/funcionarios/${f.id}`} className="font-medium hover:underline">{f.nome}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <span className="tabular">{f.matricula}</span>
                    {f.cargo && (
                      <span className={f.cargo.risco !== 'NORMAL' ? 'text-destructive' : undefined}>
                        {' '}· {f.cargo.nome}{f.cargo.risco !== 'NORMAL' ? ` (${f.cargo.risco.toLowerCase()})` : ''}
                      </span>
                    )}
                    {f.obra && <> · {f.obra.codigo}</>}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <ListaEntregasEpi linhas={entregas} />
    </div>
  )
}
