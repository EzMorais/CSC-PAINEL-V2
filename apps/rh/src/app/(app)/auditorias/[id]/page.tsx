import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ItemLinha } from '@/components/auditorias/item-linha'
import { obterAuditoria } from '@/queries/auditorias'
import { dataBR } from '@/lib/dominio/formato'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const a = await obterAuditoria(id)
  return { title: a ? `${a.titulo} — RH e SST` : 'Auditoria — RH e SST' }
}

export default async function AuditoriaPage({ params }: Props) {
  const { id } = await params
  const auditoria = await obterAuditoria(id)
  if (!auditoria) notFound()

  const conformes = auditoria.itens.filter((i) => i.situacao === 'CONFORME').length
  const naoConformes = auditoria.itens.filter((i) => i.situacao === 'NAO_CONFORME').length

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/auditorias" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Auditorias
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{auditoria.titulo}</h1>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {auditoria.norma && <span>{auditoria.norma}</span>}
          <span>Realizada em {dataBR(auditoria.realizadaEm)}</span>
          {auditoria.obra && <span>{auditoria.obra.codigo}</span>}
          {auditoria.responsavel && <span>Responsável: {auditoria.responsavel}</span>}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">
          Checklist ({conformes} conforme{conformes === 1 ? '' : 's'}, {naoConformes} não conforme{naoConformes === 1 ? '' : 's'})
        </h2>
        <ul className="mt-2" data-testid="lista-itens-auditoria">
          {auditoria.itens.map((item) => <ItemLinha key={item.id} item={item} />)}
        </ul>
      </section>
    </div>
  )
}
