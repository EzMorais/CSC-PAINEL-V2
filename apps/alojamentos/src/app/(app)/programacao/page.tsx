import Link from 'next/link'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { QuadroProgramacao } from '@/components/programacao/quadro-programacao'
import { programacaoDoDia, hojeUtc } from '@/queries/dashboard'
import { dataBR } from '@/lib/dominio/formato'

export const metadata = { title: 'Programação' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ data?: string }> }

/** Aceita só `AAAA-MM-DD`; qualquer outra coisa vira hoje, em vez de uma data inválida. */
function lerData(texto: string | undefined): Date {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return hojeUtc()
  const [a, m, d] = texto.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d))
  return Number.isNaN(data.getTime()) ? hojeUtc() : data
}

function comDeslocamento(data: Date, dias: number): string {
  return new Date(data.getTime() + dias * 86_400_000).toISOString().slice(0, 10)
}

export default async function ProgramacaoPage({ searchParams }: Props) {
  const { data: bruto } = await searchParams
  const data = lerData(bruto)
  const itens = await programacaoDoDia(data)

  const iso = data.toISOString().slice(0, 10)
  const ehHoje = iso === hojeUtc().toISOString().slice(0, 10)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Programação</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ônibus, limpeza, refeições e avisos do dia</p>
        </div>
        <Link
          href={`/programacao/nova?data=${iso}`} data-testid="nova-programacao"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="size-4" /> Nova programação
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/programacao?data=${comDeslocamento(data, -1)}`}
          aria-label="Dia anterior"
          className="grid size-9 place-items-center rounded-md border border-border hover:bg-accent"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-40 text-center text-sm font-medium" data-testid="dia-atual">
          {dataBR(data)}{ehHoje && <span className="ml-2 text-xs text-muted-foreground">hoje</span>}
        </span>
        <Link
          href={`/programacao?data=${comDeslocamento(data, 1)}`}
          aria-label="Próximo dia"
          className="grid size-9 place-items-center rounded-md border border-border hover:bg-accent"
        >
          <ChevronRight className="size-4" />
        </Link>
        {!ehHoje && (
          <Link href="/programacao" className="text-xs text-primary hover:underline">voltar para hoje</Link>
        )}
      </div>

      <QuadroProgramacao itens={itens} />
    </div>
  )
}
