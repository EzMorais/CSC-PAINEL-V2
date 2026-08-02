import { FilaAprovacoes } from '@/components/aprovacoes/fila-aprovacoes'
import { listarAprovacoes, limitesDeAprovacao } from '@/queries/aprovacoes'
import { exigirSessao } from '@/lib/auth'
import { podeAprovar, ROTULO_CARGO, type Cargo } from '@/lib/dominio/cargos'
import { STATUS_APROVACAO } from '@/lib/dominio/aprovacoes'
import { brl } from '@/lib/dominio/formato'

export const metadata = { title: 'Aprovações — Almoxarifado' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ status?: string }> }

export default async function AprovacoesPage({ searchParams }: Props) {
  const sessao = await exigirSessao()
  const { status } = await searchParams
  const [aprovacoes, limites] = await Promise.all([
    listarAprovacoes(status || STATUS_APROVACAO.PENDENTE),
    limitesDeAprovacao(),
  ])

  const decide = podeAprovar(sessao.cargo)
  const filtro = status || STATUS_APROVACAO.PENDENTE

  const abas = [
    { valor: STATUS_APROVACAO.PENDENTE, rotulo: 'Aguardando' },
    { valor: STATUS_APROVACAO.APROVADA, rotulo: 'Aprovadas' },
    { valor: STATUS_APROVACAO.REJEITADA, rotulo: 'Recusadas' },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Aprovações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que o cargo Operacional pede e a gerência autoriza
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          Seu cargo: {ROTULO_CARGO[sessao.cargo as Cargo] ?? sessao.cargo}
          {decide ? ' — você decide.' : ' — você pede, outra pessoa decide.'}
        </p>
        <p className="mt-1">
          Enquanto um pedido está aguardando, <strong>nada mudou</strong>: o saldo continua o
          mesmo e nenhum e-mail foi enviado. O efeito acontece na aprovação. Fazer o contrário
          — executar e desfazer se recusado — deixaria o estoque errado no meio do caminho e,
          na compra, um e-mail já no fornecedor que não dá para desenviar.
        </p>
        <p className="mt-2">
          Regras de hoje: perda ou quebra sempre passa por aqui; ajuste de inventário acima de{' '}
          <strong>{limites.ajuste}</strong> de diferença; compra acima de{' '}
          <strong>{brl(limites.compra)}</strong>. Quem já pode aprovar lança direto — a fila
          existe para separar quem lança de quem confere.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {abas.map((aba) => (
          <a
            key={aba.valor}
            href={`/aprovacoes?status=${aba.valor}`}
            aria-current={filtro === aba.valor ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              filtro === aba.valor
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {aba.rotulo}
          </a>
        ))}
      </nav>

      <FilaAprovacoes aprovacoes={aprovacoes} podeDecidir={decide} meuId={sessao.id} />
    </div>
  )
}
