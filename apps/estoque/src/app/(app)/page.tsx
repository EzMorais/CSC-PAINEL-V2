import Link from 'next/link'
import { Package, PackageX, TriangleAlert, Wallet, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { SeloSituacao, SeloMovimentacao } from '@/components/selo'
import { consumoPorObra, indicadores, materiaisParaRepor, movimentacoesRecentes } from '@/queries/dashboard'
import { SINAL_MOVIMENTACAO, type TipoMovimentacao } from '@/lib/dominio/constantes'
import { brl, dataBR } from '@/lib/dominio/formato'

export const metadata = { title: 'Dashboard — Almoxarifado' }
export const dynamic = 'force-dynamic'

export default async function DashboardEstoquePage() {
  const [kpis, repor, recentes, obras] = await Promise.all([
    indicadores(),
    materiaisParaRepor(),
    movimentacoesRecentes(),
    consumoPorObra(),
  ])

  const precisaComprar = kpis.semEstoque + kpis.abaixoDoMinimo

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Almoxarifado — materiais e consumo por obra</p>
      </header>

      <section aria-label="Indicadores" data-testid="kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Precisa comprar" valor={String(precisaComprar)}
          tom={precisaComprar > 0 ? 'atencao' : 'ativa'}
          detalhe={precisaComprar > 0 ? `${kpis.semEstoque} sem estoque · ${kpis.abaixoDoMinimo} abaixo do mínimo` : 'Nenhum item em falta'}
          href="/materiais?situacao=ZERADO"
          icone={<TriangleAlert className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          rotulo="Valor em estoque" valor={brl(kpis.valorEmEstoque)}
          detalhe="Pelo último preço de compra"
          icone={<Wallet className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          rotulo="Entradas no mês" valor={String(kpis.entradasDoMes)}
          icone={<ArrowDownToLine className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          rotulo="Saídas no mês" valor={String(kpis.saidasDoMes)}
          icone={<ArrowUpFromLine className="size-4 text-muted-foreground" />}
        />
      </section>

      <section aria-label="Cadastro" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Materiais ativos" valor={String(kpis.totalMateriais)}
          href="/materiais" icone={<Package className="size-4 text-muted-foreground" />}
        />
        <KpiCard rotulo="Obras ativas" valor={String(kpis.obrasAtivas)} href="/obras" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Repor no almoxarifado</h2>
            <Link href="/materiais" className="text-xs text-primary hover:underline">ver todos</Link>
          </div>
          {repor.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <PackageX className="size-4" /> Nada em falta no momento.
            </p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="repor">
              {repor.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/50 pb-2 last:border-0">
                  <div className="min-w-0">
                    <Link href={`/materiais/${m.id}`} className="text-sm font-medium hover:underline">{m.nome}</Link>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular">{m.codigo}</span>
                      {m.estoqueMinimo > 0 && <> · mínimo {m.estoqueMinimo} {m.unidade}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm tabular">{m.saldo} {m.unidade}</span>
                    <SeloSituacao situacao={m.situacao} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Consumo por obra</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Saídas menos devoluções</p>
          {obras.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma obra cadastrada.</p>
          ) : (
            <div className="mt-3 -mx-1 overflow-x-auto px-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Obra</th>
                    <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Itens</th>
                    <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {obras.map((o) => (
                    <tr key={o.codigo} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3">
                        <span className="font-medium">{o.codigo}</span>
                        <span className="block text-xs text-muted-foreground">{o.descricao}</span>
                      </td>
                      <td className="py-2 pl-3 text-right tabular">{o.itens}</td>
                      <td className="py-2 pl-3 text-right tabular">{brl(o.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Movimentações recentes</h2>
          <Link href="/movimentacoes" className="text-xs text-primary hover:underline">ver todas</Link>
        </div>
        {recentes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nada registrado ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="movimentacoes-recentes">
            {recentes.map((m) => {
              const sinal = SINAL_MOVIMENTACAO[m.tipo as TipoMovimentacao] ?? 0
              return (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/50 pb-2 last:border-0">
                  <div className="min-w-0">
                    <Link href={`/materiais/${m.materialId}`} className="text-sm font-medium hover:underline">
                      {m.material}
                    </Link>
                    <span className="ml-2"><SeloMovimentacao tipo={m.tipo} /></span>
                    {m.obra && <p className="text-xs text-muted-foreground">Obra {m.obra}</p>}
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3">
                    <span className={`text-sm tabular ${sinal > 0 ? 'text-status-ativa' : 'text-status-atencao'}`}>
                      {sinal > 0 ? '+' : '−'}{m.quantidade} {m.unidade}
                    </span>
                    <span className="text-xs tabular text-muted-foreground">{dataBR(m.ocorridoEm)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
