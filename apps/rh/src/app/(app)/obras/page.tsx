import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { STATUS } from '@/lib/dominio/constantes'

export const metadata = { title: 'Obras — RH e SST' }
export const dynamic = 'force-dynamic'

export default async function ObrasPage() {
  const obras = await prisma.obra.findMany({
    orderBy: [{ ativa: 'desc' }, { codigo: 'asc' }],
    include: {
      _count: { select: { funcionarios: { where: { status: { not: STATUS.DESLIGADO } } } } },
    },
  })

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Obras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Espelham o cadastro do Painel de Locação. O código é a chave que liga os dois sistemas.
        </p>
      </header>

      {obras.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma obra cadastrada. Rode <code className="font-mono">npm run db:seed</code>.
        </p>
      ) : (
        <>
          <ul data-testid="lista-cards" className="space-y-2 lg:hidden">
            {obras.map((o) => (
              <li key={o.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium tabular">{o.codigo}</span>
                  {!o.ativa && <span className="text-xs text-muted-foreground">inativa</span>}
                </div>
                <p className="text-sm">{o.descricao}</p>
                <p className="mt-1 text-xs text-muted-foreground">{o.cliente}</p>
                <Link href={`/funcionarios?obraId=${o.id}`} className="mt-1 inline-block text-xs hover:underline">
                  {o._count.funcionarios} no efetivo
                </Link>
              </li>
            ))}
          </ul>

          <div data-testid="tabela-obras" className="hidden overflow-x-auto rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Obra</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Responsável</th>
                  <th className="px-3 py-2 text-right font-medium">Efetivo</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {obras.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-3 py-2 tabular font-medium">{o.codigo}</td>
                    <td className="px-3 py-2">{o.descricao}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.cliente}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.responsavel ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular">
                      <Link href={`/funcionarios?obraId=${o.id}`} className="hover:underline">
                        {o._count.funcionarios}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{o.ativa ? 'Ativa' : 'Inativa'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
