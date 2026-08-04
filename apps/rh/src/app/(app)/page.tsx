import Link from 'next/link'
import { Users, UserMinus, Palmtree, UserPlus, Building2, BadgeAlert } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { GraficoAdmissoes } from '@/components/dashboard/grafico-admissoes'
import { admissoesPorMes, eventosRecentes, indicadores, porObra } from '@/queries/dashboard'
import { ROTULO_EVENTO, type TipoEvento } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

export const metadata = { title: 'Dashboard — RH e SST' }
export const dynamic = 'force-dynamic'

export default async function DashboardRh() {
  const [kpis, obras, eventos, admissoes] = await Promise.all([
    indicadores(),
    porObra(),
    eventosRecentes(),
    admissoesPorMes(),
  ])

  const pendencias = kpis.semObra + kpis.semCargo

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recursos humanos e saúde e segurança do trabalho
        </p>
      </header>

      <section aria-label="Indicadores" data-testid="kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Ativos" valor={String(kpis.ativos)} tom="ativa"
          href="/funcionarios?status=ATIVO" icone={Users}
        />
        <KpiCard
          rotulo="Afastados" valor={String(kpis.afastados)} tom="atencao"
          href="/funcionarios?status=AFASTADO" icone={UserMinus}
        />
        <KpiCard
          rotulo="Em férias" valor={String(kpis.ferias)} tom="atencao"
          href="/funcionarios?status=FERIAS" icone={Palmtree}
        />
        <KpiCard
          rotulo="Admissões no mês" valor={String(kpis.admissoesDoMes)}
          detalhe={`${kpis.desligamentosDoMes} desligamento${kpis.desligamentosDoMes === 1 ? '' : 's'} no mês`}
          icone={UserPlus}
        />
      </section>

      <section aria-label="Pendências" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Cadastros incompletos" valor={String(pendencias)}
          tom={pendencias > 0 ? 'vencida' : 'neutro'}
          detalhe={pendencias > 0 ? `${kpis.semObra} sem obra · ${kpis.semCargo} sem cargo` : 'Nenhuma pendência'}
          icone={BadgeAlert}
        />
        <KpiCard
          rotulo="Obras ativas" valor={String(kpis.totalObras)}
          href="/obras" icone={Building2}
        />
        {/* `neutro`, não um tom de alerta: desligamento é fato consumado, não pendência. */}
        <KpiCard rotulo="Desligados" valor={String(kpis.desligados)} href="/funcionarios?status=DESLIGADO" />
        <KpiCard
          rotulo="Total no cadastro"
          valor={String(kpis.ativos + kpis.afastados + kpis.ferias + kpis.desligados)}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <GraficoAdmissoes dados={admissoes} />

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-medium">Efetivo por obra</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Sem contar desligados</p>

          {obras.length === 0 ? (
            <p className="grid h-56 place-items-center text-sm text-muted-foreground">
              Nenhuma obra cadastrada.
            </p>
          ) : (
            /* Contêiner com rolagem própria: a tabela nunca arrasta a página de lado. */
            <div className="mt-4 -mx-1 overflow-x-auto px-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Obra</th>
                    <th className="pb-2 text-right font-medium">Efetivo</th>
                    <th className="pb-2 text-right font-medium">Pendências</th>
                  </tr>
                </thead>
                <tbody>
                  {obras.map((o) => (
                    <tr key={o.codigo} className="border-b border-border/50 last:border-0">
                      <td className="py-2">
                        <span className="font-medium">{o.codigo}</span>
                        <span className="block text-xs text-muted-foreground">{o.obra}</span>
                      </td>
                      <td className="py-2 text-right tabular">{o.total}</td>
                      <td className={`py-2 text-right tabular ${o.pendencias > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {o.pendencias}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium">Movimentações recentes</h2>
        {eventos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nada registrado ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="eventos-recentes">
            {eventos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/50 pb-2 last:border-0">
                <div className="min-w-0">
                  <Link href={`/funcionarios/${e.funcionarioId}`} className="text-sm font-medium hover:underline">
                    {e.funcionario}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {ROTULO_EVENTO[e.tipo as TipoEvento] ?? e.tipo}
                  </span>
                  <p className="text-xs text-muted-foreground">{e.descricaoHumana}</p>
                </div>
                <span className="shrink-0 text-xs tabular text-muted-foreground">{dataBR(e.ocorridoEm)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
