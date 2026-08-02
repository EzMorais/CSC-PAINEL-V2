import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { porObra } from '@/queries/dashboard'
import { listarAlertasVencimento } from '@/queries/treinamentos'
import { listarAlertasExame } from '@/queries/exames'
import { contarNaoConformidadesAbertas, contarNaoConformidadesVencidas } from '@/queries/nao-conformidades'
import { ROTULO_NORMA_TREINAMENTO, ROTULO_TIPO_EXAME, type NormaTreinamento, type TipoExame } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

export const metadata = { title: 'Relatórios — RH e SST' }
export const dynamic = 'force-dynamic'

const BOTAO =
  'inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent'

export default async function RelatoriosPage() {
  const [obras, treinamentosVencendo, examesVencendo, ncAbertas, ncVencidas] = await Promise.all([
    porObra(),
    listarAlertasVencimento(),
    listarAlertasExame(),
    contarNaoConformidadesAbertas(),
    contarNaoConformidadesVencidas(),
  ])

  const hoje = new Date()

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Exportação em PDF e Excel</p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Exportar</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/relatorios/funcionarios" className={BOTAO} data-testid="baixar-funcionarios-xlsx">
            <FileSpreadsheet className="size-4" /> Funcionários (Excel)
          </a>
          <a href="/api/relatorios/funcionarios?modelo=1" className={BOTAO} data-testid="baixar-modelo-xlsx">
            <Download className="size-4" /> Modelo vazio para importação (Excel)
          </a>
          <a href="/api/relatorios/resumo-pdf" className={BOTAO} data-testid="baixar-resumo-pdf">
            <FileText className="size-4" /> Resumo de SST (PDF)
          </a>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O modelo vazio tem exatamente as mesmas colunas do relatório — é o formato que uma
          futura importação em lote vai esperar. A importação em si (reler essa planilha
          preenchida de volta pro sistema) ainda não existe, só o padrão de colunas.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Efetivo por obra</h2>
        <div className="mt-3 -mx-1 overflow-x-auto px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Obra</th>
                <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Efetivo</th>
                <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Pendências</th>
              </tr>
            </thead>
            <tbody>
              {obras.map((o) => (
                <tr key={o.codigo} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3"><span className="font-medium">{o.codigo}</span> <span className="text-xs text-muted-foreground">{o.obra}</span></td>
                  <td className="py-2 pl-3 text-right tabular">{o.total}</td>
                  <td className="py-2 pl-3 text-right tabular">{o.pendencias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Treinamentos vencendo</h2>
          {treinamentosVencendo.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nada vencendo.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {treinamentosVencendo.map((a) => (
                <li key={a.id} className="flex justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
                  <span>{a.funcionario.nome} · {ROTULO_NORMA_TREINAMENTO[a.treinamento.norma as NormaTreinamento] ?? a.treinamento.norma}</span>
                  <span className={`shrink-0 tabular ${a.treinamento.validadeEm && a.treinamento.validadeEm < hoje ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {dataBR(a.treinamento.validadeEm)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Exames (ASO) vencendo</h2>
          {examesVencendo.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nada vencendo.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {examesVencendo.map((e) => (
                <li key={e.id} className="flex justify-between gap-2 border-b border-border/50 pb-1 last:border-0">
                  <span>{e.funcionario.nome} · {ROTULO_TIPO_EXAME[e.tipo as TipoExame] ?? e.tipo}</span>
                  <span className={`shrink-0 tabular ${e.validadeEm && e.validadeEm < hoje ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {dataBR(e.validadeEm)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Indicadores de SST</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {ncAbertas} não conformidade{ncAbertas === 1 ? '' : 's'} em aberto, {ncVencidas} com prazo vencido.
        </p>
      </section>
    </div>
  )
}
