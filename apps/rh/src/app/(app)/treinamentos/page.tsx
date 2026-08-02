import Link from 'next/link'
import { AlertTriangle, GraduationCap } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { FormTurma } from '@/components/treinamentos/form-turma'
import { ListaTurmas } from '@/components/treinamentos/lista-turmas'
import { contarAlertas, funcionariosParaSelecao, listarAlertasVencimento, listarTurmas } from '@/queries/treinamentos'
import { ROTULO_NORMA_TREINAMENTO, type NormaTreinamento } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

export const metadata = { title: 'Treinamentos — RH e SST' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ busca?: string; norma?: string }> }

export default async function TreinamentosPage({ searchParams }: Props) {
  const filtros = await searchParams
  const [turmas, funcionarios, alertas, contagem] = await Promise.all([
    listarTurmas(filtros),
    funcionariosParaSelecao(),
    listarAlertasVencimento(),
    contarAlertas(),
  ])

  const hoje = new Date()

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Treinamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">NRs, integração, reciclagens e certificados</p>
        </div>
        <FormTurma funcionarios={funcionarios} />
      </header>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          rotulo="Reciclagem vencida" valor={String(contagem.vencidos)}
          tom={contagem.vencidos > 0 ? 'vencida' : 'neutro'}
          icone={<AlertTriangle className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          rotulo="Vencendo em 30 dias" valor={String(contagem.vencendo)}
          tom={contagem.vencendo > 0 ? 'atencao' : 'neutro'}
          icone={<AlertTriangle className="size-4 text-muted-foreground" />}
        />
        <KpiCard rotulo="Turmas registradas" valor={String(turmas.length)} icone={<GraduationCap className="size-4 text-muted-foreground" />} />
      </section>

      {alertas.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Reciclagem vencida ou vencendo</h2>
          <ul className="mt-3 space-y-2" data-testid="alertas-vencimento">
            {alertas.map((a) => {
              const vencido = a.treinamento.validadeEm ? a.treinamento.validadeEm < hoje : false
              return (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/50 pb-2 last:border-0">
                  <div className="min-w-0">
                    <Link href={`/treinamentos/${a.treinamento.id}`} className="text-sm font-medium hover:underline">
                      {a.funcionario.nome}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {a.treinamento.descricao} · {ROTULO_NORMA_TREINAMENTO[a.treinamento.norma as NormaTreinamento] ?? a.treinamento.norma}
                    </span>
                  </div>
                  <span className={`shrink-0 text-xs tabular ${vencido ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {vencido ? 'venceu em' : 'vence em'} {dataBR(a.treinamento.validadeEm)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ListaTurmas linhas={turmas} />
    </div>
  )
}
