import { ArrowUpRight, Lock, ShieldCheck, LayoutDashboard } from 'lucide-react'
import { exigirSessao, temAcesso } from '@/lib/auth'
import {
  MODULO, ROTULO_MODULO, URL_MODULO, ROTULO_CARGO, DESCRICAO_CARGO,
  podeAprovar, podeLancar, type Cargo, type Modulo,
} from '@/lib/dominio/cargos'
import {
  IlustracaoLocacao, IlustracaoRh, IlustracaoEstoque, IlustracaoFrota,
  IlustracaoAlojamentos, IlustracaoCadastros, IlustracaoProgramacao,
} from '@/components/marca/ilustracoes'

export const metadata = { title: 'Portal — Construtora Siqueira Campos' }
export const dynamic = 'force-dynamic'

const SISTEMAS: Array<{
  modulo: Modulo
  descricao: string
  Ilustracao: typeof IlustracaoLocacao
  /** Faixa lateral do cartão — alterna as duas cores da marca para a lista não virar um bloco só. */
  faixa: string
}> = [
  { modulo: MODULO.PROGRAMACAO, descricao: 'Quem trabalha em qual frente amanhã, e a frota de cada uma', Ilustracao: IlustracaoProgramacao, faixa: 'from-marca-azul-fundo to-marca-azul-fundo-claro' },
  { modulo: MODULO.CADASTROS,   descricao: 'Obras, casas, veículos, máquinas e materiais num lugar só', Ilustracao: IlustracaoCadastros,   faixa: 'from-marca-vermelho-fundo to-marca-vermelho-fundo-claro' },
  { modulo: MODULO.PAINEL,      descricao: 'Equipamentos alugados por obra, vencimentos e custo',       Ilustracao: IlustracaoLocacao,     faixa: 'from-marca-vermelho-fundo to-marca-vermelho-fundo-claro' },
  { modulo: MODULO.RH,          descricao: 'Funcionários, treinamentos, exames, EPIs e documentos',     Ilustracao: IlustracaoRh,          faixa: 'from-marca-azul-fundo to-marca-azul-fundo-claro' },
  { modulo: MODULO.ESTOQUE,     descricao: 'Materiais, entradas e saídas por obra, compras',            Ilustracao: IlustracaoEstoque,     faixa: 'from-marca-vermelho-fundo to-marca-vermelho-fundo-claro' },
  { modulo: MODULO.ALOJAMENTOS, descricao: 'Moradia dos funcionários, pedidos e programação',           Ilustracao: IlustracaoAlojamentos, faixa: 'from-marca-azul-fundo to-marca-azul-fundo-claro' },
  { modulo: MODULO.FROTA,       descricao: 'Veículos, manutenções e abastecimento',                     Ilustracao: IlustracaoFrota,       faixa: 'from-marca-vermelho-fundo to-marca-vermelho-fundo-claro' },
]

export default async function PortalPage() {
  const sessao = await exigirSessao()
  const cargo = sessao.cargo as Cargo

  const liberados = SISTEMAS.filter((s) => temAcesso(sessao, s.modulo))
  const bloqueados = SISTEMAS.filter((s) => !temAcesso(sessao, s.modulo))

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="overflow-hidden rounded-xl bg-gradient-to-r from-marca-azul-fundo to-marca-azul-fundo-claro p-5 text-white shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold">Olá, {sessao.nome.split(' ')[0]}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-white/85">
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
            {ROTULO_CARGO[cargo] ?? cargo}
          </span>
          {DESCRICAO_CARGO[cargo]}
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold">
          <ShieldCheck className="size-4 text-marca-azul" /> O que o seu cargo permite
        </h2>
        <ul className="divide-y divide-border/60">
          <LinhaPermissao ativo={podeLancar(cargo)} texto="Lançar no dia a dia (cadastrar, movimentar, registrar)" />
          <LinhaPermissao ativo={podeAprovar(cargo)} texto="Aprovar o que outra pessoa lançou" />
          <LinhaPermissao ativo={cargo === 'ADMIN'} texto="Cadastrar usuários e definir cargos" />
        </ul>
        <p className="border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          Quem lança não aprova o próprio lançamento — é isso que faz a aprovação valer
          alguma coisa. Por isso o cargo Operacional não aprova.
        </p>
      </section>

      <a
        href="/dashboard"
        className="group flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm
                   transition-all hover:-translate-y-0.5 hover:border-marca-vermelho/40 hover:shadow-md"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-marca-vermelho-fundo to-marca-vermelho-fundo-claro text-white">
          <LayoutDashboard className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold">
            Dashboard geral
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Os números de todos os sistemas numa tela só
          </span>
        </span>
      </a>

      <section aria-label="Sistemas">
        <h2 className="text-sm font-semibold">Seus sistemas</h2>
        {liberados.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Você ainda não tem acesso a nenhum sistema. Peça ao administrador para liberar.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {liberados.map(({ modulo, descricao, Ilustracao, faixa }) => (
              <a
                key={modulo} href={URL_MODULO[modulo]} data-testid={`sistema-${modulo}`}
                className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-card
                           p-4 pl-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:gap-6"
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${faixa}`} />
                <Ilustracao className="size-16 shrink-0 sm:size-20" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-base font-semibold">
                    {ROTULO_MODULO[modulo]}
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{descricao}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      {bloqueados.length > 0 && (
        <section aria-label="Sem acesso">
          <h2 className="text-sm font-medium text-muted-foreground">Sem acesso</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {bloqueados.map(({ modulo }) => (
              <span
                key={modulo}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Lock className="size-3.5" /> {ROTULO_MODULO[modulo]}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Aparecem aqui de propósito: esconder mostraria um sistema a menos do que a empresa
            tem, e você não saberia o que pedir.
          </p>
        </section>
      )}
    </div>
  )
}

function LinhaPermissao({ ativo, texto }: { ativo: boolean; texto: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          ativo ? 'bg-status-ativa/20 text-status-ativa' : 'bg-muted text-muted-foreground'
        }`}
      >
        {ativo ? '✓' : '—'}
      </span>
      <span className={ativo ? '' : 'text-muted-foreground'}>{texto}</span>
    </li>
  )
}
