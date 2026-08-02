import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ParticipanteLinha } from '@/components/treinamentos/participante-linha'
import { obterTurma } from '@/queries/treinamentos'
import { ROTULO_NORMA_TREINAMENTO, type NormaTreinamento } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const t = await obterTurma(id)
  return { title: t ? `${t.descricao} — RH e SST` : 'Turma — RH e SST' }
}

export default async function TurmaPage({ params }: Props) {
  const { id } = await params
  const turma = await obterTurma(id)
  if (!turma) notFound()

  const hoje = new Date()
  const vencido = turma.validadeEm ? turma.validadeEm < hoje : false

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/treinamentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Treinamentos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{turma.descricao}</h1>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{ROTULO_NORMA_TREINAMENTO[turma.norma as NormaTreinamento] ?? turma.norma}</span>
          <span>Realizado em {dataBR(turma.realizadoEm)}</span>
          {turma.instrutor && <span>Instrutor: {turma.instrutor}</span>}
          {turma.cargaHoraria && <span>{turma.cargaHoraria}h</span>}
          {turma.validadeEm && (
            <span className={vencido ? 'text-destructive' : undefined}>
              {vencido ? 'Venceu em' : 'Válido até'} {dataBR(turma.validadeEm)}
            </span>
          )}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Participantes ({turma.participantes.length})</h2>
        {turma.participantes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum participante.</p>
        ) : (
          <ul className="mt-2" data-testid="lista-participantes">
            {turma.participantes.map((p) => (
              <ParticipanteLinha key={p.id} participante={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
