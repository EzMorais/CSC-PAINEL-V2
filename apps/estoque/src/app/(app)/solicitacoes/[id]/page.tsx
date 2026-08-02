import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { EnviarEmail } from '@/components/solicitacoes/enviar-email'
import { AcoesStatus } from '@/components/solicitacoes/acoes-status'
import { obterSolicitacao } from '@/queries/solicitacoes'
import { listarFornecedores } from '@/queries/movimentacoes'
import { assuntoDoEmail, corpoDoEmail } from '@/lib/dominio/email-solicitacao'
import {
  ROTULO_STATUS_SOLICITACAO, TOM_STATUS_SOLICITACAO, type StatusSolicitacao,
} from '@/lib/dominio/constantes'
import { brl, dataBR } from '@/lib/dominio/formato'

export const dynamic = 'force-dynamic'

const COR_TOM: Record<string, string> = {
  ativa: 'bg-status-ativa/15 text-status-ativa',
  atencao: 'bg-status-atencao/15 text-status-atencao',
  vencida: 'bg-status-vencida/15 text-status-vencida',
  devolvida: 'bg-status-devolvida/15 text-status-devolvida',
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const s = await obterSolicitacao(id)
  return { title: s ? `${s.numero} — Almoxarifado` : 'Solicitação — Almoxarifado' }
}

export default async function SolicitacaoPage({ params }: Props) {
  const { id } = await params
  const [solicitacao, fornecedores] = await Promise.all([obterSolicitacao(id), listarFornecedores()])
  if (!solicitacao) notFound()

  const itensEmail = solicitacao.itens.map((i) => ({
    codigo: i.material.codigo,
    nome: i.material.nome,
    unidade: i.material.unidade,
    quantidade: i.quantidade,
    saldoNaEpoca: i.saldoNaEpoca,
    minimoNaEpoca: i.minimoNaEpoca,
    precoEstimado: i.precoEstimado,
  }))

  const paraEmail = {
    numero: solicitacao.numero,
    criadoEm: solicitacao.criadoEm,
    observacao: solicitacao.observacao,
    registradoPor: solicitacao.registradoPor,
    itens: itensEmail,
  }

  const total = solicitacao.itens.reduce(
    (s, i) => s + (i.precoEstimado != null ? i.precoEstimado * i.quantidade : 0),
    0,
  )
  const tom = TOM_STATUS_SOLICITACAO[solicitacao.status as StatusSolicitacao] ?? 'devolvida'

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/solicitacoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Solicitações
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tabular" data-testid="numero-solicitacao">{solicitacao.numero}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_TOM[tom]}`}>
            {ROTULO_STATUS_SOLICITACAO[solicitacao.status as StatusSolicitacao] ?? solicitacao.status}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>Emitida em {dataBR(solicitacao.criadoEm)}</span>
          {solicitacao.registradoPor && <span>por {solicitacao.registradoPor}</span>}
          {solicitacao.enviadaEm && <span>Enviada em {dataBR(solicitacao.enviadaEm)}</span>}
          {solicitacao.atendidaEm && <span>Atendida em {dataBR(solicitacao.atendidaEm)}</span>}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Itens</h2>
        <div className="mt-3 -mx-1 overflow-x-auto px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Material</th>
                <th className="whitespace-nowrap pb-2 px-3 text-right font-medium">Quantidade</th>
                <th className="whitespace-nowrap pb-2 px-3 text-right font-medium">Saldo na época</th>
                <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Estimativa</th>
              </tr>
            </thead>
            <tbody data-testid="itens-solicitacao">
              {solicitacao.itens.map((i) => (
                <tr key={i.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3">
                    <Link href={`/materiais/${i.material.id}`} className="font-medium hover:underline">
                      {i.material.nome}
                    </Link>
                    <span className="block text-xs tabular text-muted-foreground">{i.material.codigo}</span>
                  </td>
                  <td className="whitespace-nowrap py-2 px-3 text-right tabular">{i.quantidade} {i.material.unidade}</td>
                  <td className="whitespace-nowrap py-2 px-3 text-right tabular text-muted-foreground">
                    {i.saldoNaEpoca} / {i.minimoNaEpoca || '—'}
                  </td>
                  <td className="py-2 pl-3 text-right tabular text-muted-foreground">
                    {i.precoEstimado != null ? brl(i.precoEstimado * i.quantidade) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <p className="mt-3 text-right text-sm">
            Estimativa pela última compra: <span className="tabular font-medium">{brl(total)}</span>
          </p>
        )}
        {solicitacao.observacao && (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">{solicitacao.observacao}</p>
        )}
      </section>

      <EnviarEmail
        solicitacaoId={solicitacao.id}
        status={solicitacao.status}
        assunto={assuntoDoEmail(paraEmail)}
        corpo={corpoDoEmail(paraEmail)}
        fornecedores={fornecedores.map((f) => ({ id: f.id, nome: f.nome, email: f.email }))}
      />

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Situação do pedido</h2>
        <AcoesStatus id={solicitacao.id} status={solicitacao.status} />
      </section>
    </div>
  )
}
