import { AlertTriangle, CircleAlert, Package, PackageX, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { GraficoFornecedor } from '@/components/dashboard/grafico-fornecedor'
import { GraficoObra } from '@/components/dashboard/grafico-obra'
import { TabelaVencimentos } from '@/components/dashboard/tabela-vencimentos'
import { brl } from '@/lib/dominio/formato'
import { obterIndicadores, obterPorFornecedor, obterPorObra, obterVencimentosProximos } from '@/queries/dashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [kpi, porFornecedor, porObra, vencimentos] = await Promise.all([
    obterIndicadores(),
    obterPorFornecedor(),
    obterPorObra(),
    obterVencimentosProximos(),
  ])

  // Mesma cláusula de `obterVencimentosProximos` (`dataFim <= hoje+7`, não devolvida),
  // partida em duas pelo início de hoje: vencidos + os que vencem em 7 dias. Derivar
  // daqui em vez de fazer um `count` novo mantém o total no mesmo instante `hoje` dos
  // cartões — duas chamadas a `new Date()` discordariam na virada da meia-noite.
  const totalVencimentos = kpi.vencidos + kpi.vencemEm7Dias

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Equipamentos locados por obra</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/xlsx" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Exportar Excel
          </a>
          <a href="/api/export/pdf" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Exportar PDF
          </a>
        </div>
      </header>

      <section aria-label="Indicadores" data-testid="kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard rotulo="Em locação" valor={brl(kpi.valorEmLocacao)} detalhe={`${kpi.ativos} itens ativos`}
                 icone={<Wallet className="size-4 text-muted-foreground" />} />
        <KpiCard rotulo="Itens ativos" valor={String(kpi.ativos)} detalhe="em aberto" tom="ativa"
                 href="/locacoes" icone={<Package className="size-4 text-muted-foreground" />} />
        <KpiCard rotulo="Vencem em 7 dias" valor={String(kpi.vencemEm7Dias)} detalhe="exigem atenção" tom="atencao"
                 href="/locacoes?status=ATENCAO" icone={<AlertTriangle className="size-4 text-muted-foreground" />} />
        <KpiCard rotulo="Vencidos" valor={String(kpi.vencidos)} detalhe="prazo encerrado" tom="vencida"
                 href="/locacoes?status=VENCIDA" icone={<CircleAlert className="size-4 text-muted-foreground" />} />
        {/* `perdidos` conta todos os itens perdidos, inclusive os de locações já
            encerradas — prejuízo consumado, pago ao locador. `perdidosEmAberto` é o
            que ainda dá para acertar. Mostrar só o segundo apagaria o custo do painel. */}
        <KpiCard rotulo="Itens perdidos" valor={String(kpi.perdidos)}
                 detalhe={`${kpi.perdidosEmAberto} ainda a acertar com o locador`} tom="perdido"
                 href="/locacoes?estado=PERDIDO&status=TODAS" icone={<PackageX className="size-4 text-muted-foreground" />} />
      </section>

      {kpi.aConfirmar > 0 && (
        <div role="status" className="rounded-lg border border-amber-600/50 bg-amber-600/10 p-4 text-sm">
          <strong className="font-medium">{kpi.aConfirmar} itens com obra a confirmar.</strong>{' '}
          Vieram de abas compartilhadas por mais de uma obra na planilha.{' '}
          <a href="/locacoes?aConfirmar=1" className="font-medium underline">Reclassificar</a>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="min-w-0 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Valor por fornecedor</h2>
          <GraficoFornecedor dados={porFornecedor} />
        </section>
        <section className="min-w-0 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium">Valor por obra</h2>
          <GraficoObra dados={porObra} />
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        {/* "Vencidos e" no título não é redundância: a consulta não tem piso inferior
            de data e, com os dados de hoje, as 25 linhas são todas de itens já
            vencidos. Um título só de "próximos 7 dias" descreveria a tela errada. */}
        <h2 className="mb-2 font-medium">Vencidos e vencendo em até 7 dias</h2>
        <TabelaVencimentos itens={vencimentos} total={totalVencimentos} />
      </section>
    </div>
  )
}
