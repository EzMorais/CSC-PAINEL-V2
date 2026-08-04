import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarPlus, ArrowRight, CircleCheck, PencilLine } from 'lucide-react'
import { exigirSessao } from '@/lib/auth'
import { podeLancar } from '@/lib/dominio/cargos'
import { diasRecentes } from '@/queries/programacao'
import { amanhaUtc, hojeUtc, paraIso, tituloDoDia, STATUS_PROGRAMACAO } from '@/lib/dominio/constantes'

export const metadata = { title: 'Programação — Construtora Siqueira Campos' }
export const dynamic = 'force-dynamic'

export default async function InicioPage() {
  const sessao = await exigirSessao()
  const dias = await diasRecentes()

  const amanha = amanhaUtc()
  const hoje = hojeUtc()
  const jaTemAmanha = dias.some((d) => d.data.getTime() === amanha.getTime())

  // O caminho normal é montar a de amanhã: é sempre um dia à frente que ela é lançada. Sem
  // este atalho, a primeira coisa a fazer todo dia seria procurar a data no calendário.
  if (dias.length === 0) redirect(`/dia/${paraIso(amanha)}`)

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Programação diária</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem trabalha em qual frente, e quais veículos vão para cada uma
        </p>
      </header>

      {podeLancar(sessao.cargo) && (
        <Link
          href={`/dia/${paraIso(amanha)}`}
          data-testid="montar-amanha"
          className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <CalendarPlus className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {jaTemAmanha ? 'Continuar a de amanhã' : 'Montar a de amanhã'}
            </span>
            <span className="block text-sm text-muted-foreground">{tituloDoDia(amanha)}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <section>
        <h2 className="text-sm font-medium">Últimos dias</h2>
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card" data-testid="lista-dias">
          {dias.map((d) => {
            const publicada = d.status === STATUS_PROGRAMACAO.PUBLICADA
            return (
              <li key={d.id}>
                <Link
                  href={`/dia/${paraIso(d.data)}`}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {tituloDoDia(d.data)}
                      {d.data.getTime() === hoje.getTime() && (
                        <span className="ml-2 text-xs text-muted-foreground">hoje</span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {d._count.escalas} {d._count.escalas === 1 ? 'pessoa' : 'pessoas'}
                    </span>
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      publicada ? 'bg-status-ativa/15 text-status-ativa' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {publicada ? <CircleCheck className="size-3" /> : <PencilLine className="size-3" />}
                    {publicada ? 'publicada' : 'rascunho'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
