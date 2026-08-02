import Link from 'next/link'
import { Download, FileSpreadsheet } from 'lucide-react'
import { SeloSituacao } from '@/components/selo'
import { consumoPorObra, indicadores, materiaisParaRepor } from '@/queries/dashboard'
import { listarMateriaisComSaldo } from '@/queries/saldos'
import { ROTULO_CATEGORIA_MATERIAL, type CategoriaMaterial } from '@/lib/dominio/constantes'
import { brl } from '@/lib/dominio/formato'

export const metadata = { title: 'Relatórios — Almoxarifado' }
export const dynamic = 'force-dynamic'

const BOTAO = 'inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent'

export default async function RelatoriosPage() {
  const [kpis, repor, obras, materiais] = await Promise.all([
    indicadores(),
    materiaisParaRepor(50),
    consumoPorObra(),
    listarMateriaisComSaldo(),
  ])

  // Valor parado por categoria: onde o dinheiro do almoxarifado está.
  const porCategoria = new Map<string, { itens: number; valor: number }>()
  for (const m of materiais) {
    if (!m.ativo) continue
    const atual = porCategoria.get(m.categoria) ?? { itens: 0, valor: 0 }
    porCategoria.set(m.categoria, {
      itens: atual.itens + 1,
      valor: atual.valor + Math.max(0, m.valorEmEstoque ?? 0),
    })
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1].valor - a[1].valor)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Posição de estoque, consumo e exportação</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Exportar</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/relatorios/estoque" className={BOTAO} data-testid="baixar-estoque-xlsx">
            <FileSpreadsheet className="size-4" /> Estoque e movimentações (Excel)
          </a>
          <a href="/api/relatorios/estoque?modelo=1" className={BOTAO} data-testid="baixar-modelo-xlsx">
            <Download className="size-4" /> Modelo vazio para importação (Excel)
          </a>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A planilha sai com duas abas: posição atual de cada material e o histórico completo de
          movimentações. Na aba de movimentações a quantidade vem com sinal — saída negativa —
          para que somar a coluna dê o saldo. O modelo vazio tem exatamente as mesmas colunas: é
          o formato que uma futura importação em lote vai esperar. A importação em si ainda não
          existe, só o padrão de colunas.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor em estoque</p>
          <p className="mt-2 text-2xl font-semibold tabular">{brl(kpis.valorEmEstoque)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pelo último preço de compra</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Materiais ativos</p>
          <p className="mt-2 text-2xl font-semibold tabular">{kpis.totalMateriais}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Precisa comprar</p>
          <p className="mt-2 text-2xl font-semibold tabular">{kpis.semEstoque + kpis.abaixoDoMinimo}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Valor por categoria</h2>
        {categorias.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum material cadastrado.</p>
        ) : (
          <div className="mt-3 -mx-1 overflow-x-auto px-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Categoria</th>
                  <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Itens</th>
                  <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(([categoria, dados]) => (
                  <tr key={categoria} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3">{ROTULO_CATEGORIA_MATERIAL[categoria as CategoriaMaterial] ?? categoria}</td>
                    <td className="py-2 pl-3 text-right tabular">{dados.itens}</td>
                    <td className="py-2 pl-3 text-right tabular">{brl(dados.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Lista de compras</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Sem estoque ou abaixo do mínimo</p>
          {repor.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nada em falta.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm" data-testid="lista-compras">
              {repor.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
                  <Link href={`/materiais/${m.id}`} className="hover:underline">{m.nome}</Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular text-muted-foreground">{m.saldo} / {m.estoqueMinimo || '—'} {m.unidade}</span>
                    <SeloSituacao situacao={m.situacao} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Consumo por obra</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Saídas menos devoluções</p>
          {obras.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma obra cadastrada.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {obras.map((o) => (
                <li key={o.codigo} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
                  <span><span className="tabular font-medium">{o.codigo}</span> <span className="text-muted-foreground">{o.descricao}</span></span>
                  <span className="shrink-0 tabular text-muted-foreground">{o.itens} itens · {brl(o.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
