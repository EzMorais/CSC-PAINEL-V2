import Link from 'next/link'
import { Plus } from 'lucide-react'
import { listarSolicitacoes } from '@/queries/solicitacoes'
import {
  ROTULO_STATUS_SOLICITACAO, TOM_STATUS_SOLICITACAO, type StatusSolicitacao,
} from '@/lib/dominio/constantes'
import { brl, dataBR } from '@/lib/dominio/formato'

export const metadata = { title: 'Solicitações de compra — Almoxarifado' }
export const dynamic = 'force-dynamic'

const COR_TOM: Record<string, string> = {
  ativa: 'bg-status-ativa/15 text-status-ativa',
  atencao: 'bg-status-atencao/15 text-status-atencao',
  vencida: 'bg-status-vencida/15 text-status-vencida',
  devolvida: 'bg-status-devolvida/15 text-status-devolvida',
}

export default async function SolicitacoesPage() {
  const solicitacoes = await listarSolicitacoes()

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Solicitações de compra</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedidos montados a partir do que está faltando no almoxarifado
          </p>
        </div>
        <Link
          href="/solicitacoes/nova"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="size-4" /> Nova solicitação
        </Link>
      </header>

      <p className="text-sm text-muted-foreground" data-testid="contagem-solicitacoes">
        {solicitacoes.length} {solicitacoes.length === 1 ? 'solicitação' : 'solicitações'}
      </p>

      {solicitacoes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma solicitação ainda. Clique em &quot;Nova solicitação&quot; para o sistema montar
          uma a partir do que está abaixo do mínimo.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="lista-solicitacoes">
          {solicitacoes.map((s) => {
            const total = s.itens.reduce(
              (soma, i) => soma + (i.precoEstimado != null ? i.precoEstimado * i.quantidade : 0),
              0,
            )
            const tom = TOM_STATUS_SOLICITACAO[s.status as StatusSolicitacao] ?? 'devolvida'
            return (
              <li key={s.id}>
                <Link
                  href={`/solicitacoes/${s.id}`}
                  className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-medium tabular">{s.numero}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_TOM[tom]}`}>
                      {ROTULO_STATUS_SOLICITACAO[s.status as StatusSolicitacao] ?? s.status}
                    </span>
                    <span className="text-xs tabular text-muted-foreground">{dataBR(s.criadoEm)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.itens.length} {s.itens.length === 1 ? 'item' : 'itens'}
                    {total > 0 && <> · estimativa {brl(total)}</>}
                    {s.registradoPor && <> · por {s.registradoPor}</>}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
