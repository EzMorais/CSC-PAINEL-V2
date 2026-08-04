import Link from 'next/link'
import { House, BedDouble, ClipboardList, CalendarDays, Bus, DoorOpen, Plus } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { SeloStatusPedido, SeloTipoPedido, SeloTipoProgramacao } from '@/components/selo'
import { indicadores, pedidosRecentes, programacaoDoDia, hojeUtc } from '@/queries/dashboard'
import { listarAlojamentos } from '@/queries/alojamentos'
import { dataBR } from '@/lib/dominio/formato'

export const metadata = { title: 'Painel — Alojamentos' }
export const dynamic = 'force-dynamic'

const ATALHO = 'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent'

export default async function PainelAlojamentos() {
  const hoje = hojeUtc()
  const [kpis, pedidos, programacao, alojamentos] = await Promise.all([
    indicadores(),
    pedidosRecentes(),
    programacaoDoDia(hoje),
    listarAlojamentos(),
  ])

  const ativos = alojamentos.filter((a) => a.ativo)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Moradia, pedidos e programação do dia — {dataBR(hoje)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/moradores/novo" className={ATALHO}><Plus className="size-4" /> Alocar morador</Link>
          <Link href="/pedidos/novo" className={ATALHO}><Plus className="size-4" /> Novo pedido</Link>
          <Link href="/programacao/nova" className={ATALHO}><Plus className="size-4" /> Nova programação</Link>
        </div>
      </header>

      <section aria-label="Indicadores" data-testid="kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Moradores" valor={String(kpis.ocupados)}
          detalhe={kpis.capacidade > 0 ? `de ${kpis.capacidade} vagas` : 'sem capacidade cadastrada'}
          tom="ativa" href="/moradores" icone={BedDouble}
        />
        <KpiCard
          rotulo="Vagas livres" valor={String(kpis.vagas)}
          tom={kpis.vagas === 0 && kpis.capacidade > 0 ? 'atencao' : 'neutro'}
          detalhe={kpis.vagas === 0 && kpis.capacidade > 0 ? 'todos os alojamentos lotados' : undefined}
          icone={DoorOpen}
        />
        <KpiCard
          rotulo="Pedidos em aberto" valor={String(kpis.pedidosAbertos)}
          tom={kpis.pedidosAbertos > 0 ? 'atencao' : 'ativa'}
          detalhe={kpis.pedidosAbertos > 0 ? 'aguardando alguém resolver' : 'nada pendente'}
          href="/pedidos" icone={ClipboardList}
        />
        <KpiCard
          rotulo="Programação de hoje" valor={String(kpis.programacoesHoje)}
          href="/programacao" icone={CalendarDays}
        />
      </section>

      <section aria-label="Cadastro" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard rotulo="Alojamentos" valor={String(kpis.totalAlojamentos)} href="/alojamentos" icone={House} />
        <KpiCard rotulo="Rotas de ônibus" valor={String(kpis.rotas)} href="/rotas" icone={Bus} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Programação de hoje</h2>
            <Link href="/programacao" className="text-xs text-primary hover:underline">ver tudo</Link>
          </div>
          {programacao.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" /> Nada programado para hoje.
            </p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="programacao-hoje">
              {programacao.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/50 pb-2 last:border-0">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{p.titulo}</span>
                    <span className="ml-2"><SeloTipoProgramacao tipo={p.tipo} /></span>
                    <p className="text-xs text-muted-foreground">
                      {p.alojamento?.nome ?? 'Todos os alojamentos'}
                      {p.responsavelNome && <> · {p.responsavelNome}</>}
                    </p>
                  </div>
                  {p.horario && <span className="shrink-0 text-sm tabular text-muted-foreground">{p.horario}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Pedidos recentes</h2>
            <Link href="/pedidos" className="text-xs text-primary hover:underline">ver todos</Link>
          </div>
          {pedidos.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList className="size-4" /> Nenhum pedido registrado.
            </p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="pedidos-recentes">
              {pedidos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/50 pb-2 last:border-0">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{p.titulo}</span>
                    <span className="ml-2"><SeloTipoPedido tipo={p.tipo} /></span>
                    <p className="text-xs text-muted-foreground">
                      {p.alojamento.nome}
                      {p.funcionarioNome && <> · {p.funcionarioNome}</>}
                    </p>
                  </div>
                  <SeloStatusPedido status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Ocupação por alojamento</h2>
          <Link href="/alojamentos" className="text-xs text-primary hover:underline">ver todos</Link>
        </div>
        {ativos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum alojamento cadastrado.{' '}
            <Link href="/alojamentos/novo" className="text-primary hover:underline">Cadastrar o primeiro</Link>.
          </p>
        ) : (
          <div className="mt-3 -mx-1 overflow-x-auto px-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Alojamento</th>
                  <th className="whitespace-nowrap pb-2 px-3 text-right font-medium">Quartos</th>
                  <th className="whitespace-nowrap pb-2 px-3 text-right font-medium">Ocupação</th>
                  <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Vagas</th>
                </tr>
              </thead>
              <tbody data-testid="ocupacao">
                {ativos.map((a) => {
                  const vagas = Math.max(0, a.capacidade - a.ocupados)
                  return (
                    <tr key={a.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3">
                        <Link href={`/alojamentos/${a.id}`} className="font-medium hover:underline">{a.nome}</Link>
                        {(a.cidade || a.bairro) && (
                          <span className="block text-xs text-muted-foreground">
                            {[a.bairro, a.cidade, a.uf].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular text-muted-foreground">{a.quartos}</td>
                      <td className="py-2 px-3 text-right tabular">
                        {a.ocupados}{a.capacidade > 0 && <span className="text-muted-foreground"> / {a.capacidade}</span>}
                      </td>
                      <td className={`py-2 pl-3 text-right tabular ${vagas === 0 && a.capacidade > 0 ? 'text-status-atencao' : 'text-muted-foreground'}`}>
                        {a.capacidade > 0 ? vagas : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
