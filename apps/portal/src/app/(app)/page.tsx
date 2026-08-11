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

export const metadata = { title: 'Portal - Construtora Siqueira Campos' }
export const dynamic = 'force-dynamic'

const SISTEMAS: Array<{
  modulo: Modulo
  descricao: string
  Ilustracao: typeof IlustracaoLocacao
  faixa: string
}> = [
  { modulo: MODULO.PROGRAMACAO, descricao: 'Quem trabalha em qual frente amanha, e a frota de cada uma', Ilustracao: IlustracaoProgramacao, faixa: 'from-marca-azul-fundo to-marca-azul-fundo-claro' },
  { modulo: MODULO.CADASTROS, descricao: 'Obras, casas, veiculos, maquinas e materiais num lugar so', Ilustracao: IlustracaoCadastros, faixa: 'from-marca-vermelho-fundo to-marca-vermelho-fundo-claro' },
  { modulo: MODULO.PAINEL, descricao: 'Equipamentos alugados por obra, vencimentos e custo', Ilustracao: IlustracaoLocacao, faixa: 'from-marca-vermelho-fundo to-marca-vermelho-fundo-claro' },
  { modulo: MODULO.RH, descricao: 'Funcionarios, treinamentos, exames, EPIs e documentos', Ilustracao: IlustracaoRh, faixa: 'from-marca-azul-fundo to-marca-azul-fundo-claro' },
  { modulo: MODULO.ESTOQUE, descricao: 'Materiais, entradas e saidas por obra, compras', Ilustracao: IlustracaoEstoque, faixa: 'from-marca-vermelho-fundo to-marca-vermelho-fundo-claro' },
  { modulo: MODULO.ALOJAMENTOS, descricao: 'Moradia dos funcionarios, pedidos e programacao', Ilustracao: IlustracaoAlojamentos, faixa: 'from-marca-azul-fundo to-marca-azul-fundo-claro' },
  { modulo: MODULO.FROTA, descricao: 'Veiculos, manutencoes e abastecimento', Ilustracao: IlustracaoFrota, faixa: 'from-marca-vermelho-fundo to-marca-vermelho-fundo-claro' },
]

export default async function PortalPage() {
  const sessao = await exigirSessao()
  const cargo = sessao.cargo as Cargo

  const liberados = SISTEMAS.filter((s) => temAcesso(sessao, s.modulo))
  const bloqueados = SISTEMAS.filter((s) => !temAcesso(sessao, s.modulo))

  return (
    <div className="page-shell mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="surface-hero rounded-sm p-5 text-white sm:p-6">
        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/75">Portal central</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ola, {sessao.nome.split(' ')[0]}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/86">
            <span className="rounded-sm border-2 border-white/25 bg-white/18 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-white">
              {ROTULO_CARGO[cargo] ?? cargo}
            </span>
            {DESCRICAO_CARGO[cargo]}
          </p>
        </div>
      </header>

      <section className="surface-card overflow-hidden rounded-sm">
        <h2 className="flex items-center gap-2 border-b-2 border-black/10 bg-muted/45 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em]">
          <ShieldCheck className="size-4 text-marca-azul" /> O que o seu cargo permite
        </h2>
        <ul className="divide-y divide-border/60">
          <LinhaPermissao ativo={podeLancar(cargo)} texto="Lancar no dia a dia (cadastrar, movimentar, registrar)" />
          <LinhaPermissao ativo={podeAprovar(cargo)} texto="Aprovar o que outra pessoa lancou" />
          <LinhaPermissao ativo={cargo === 'ADMIN'} texto="Cadastrar usuarios e definir cargos" />
        </ul>
        <p className="border-t border-border/70 bg-muted/25 px-4 py-2.5 text-xs text-muted-foreground">
          Quem lanca nao aprova o proprio lancamento - isso faz a aprovacao valer de verdade.
        </p>
      </section>

      <a
        href="/dashboard"
        className="surface-card group flex items-center gap-4 overflow-hidden rounded-sm p-4 transition-all hover:-translate-y-0.5 hover:border-marca-vermelho/40 hover:shadow-md"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-sm border-2 border-white/20 bg-gradient-to-br from-marca-vermelho-fundo to-marca-vermelho-fundo-claro text-white shadow-[4px_4px_0_var(--marca-vermelho)]">
          <LayoutDashboard className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold">
            Dashboard geral
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Os numeros de todos os sistemas numa tela so
          </span>
        </span>
      </a>

      <section aria-label="Sistemas">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Seus sistemas</h2>
        {liberados.length === 0 ? (
          <p className="surface-card mt-3 rounded-sm border-dashed p-8 text-center text-sm text-muted-foreground">
            Voce ainda nao tem acesso a nenhum sistema. Peça ao administrador para liberar.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {liberados.map(({ modulo, descricao, Ilustracao, faixa }) => (
              <a
                key={modulo}
                href={URL_MODULO[modulo]}
                data-testid={`sistema-${modulo}`}
                className="surface-card group relative flex items-center gap-4 overflow-hidden rounded-sm p-4 pl-6 transition-all hover:-translate-y-0.5 hover:shadow-md sm:gap-6"
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
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Sem acesso</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {bloqueados.map(({ modulo }) => (
              <span
                key={modulo}
                className="inline-flex items-center gap-1.5 rounded-sm border-2 border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Lock className="size-3.5" /> {ROTULO_MODULO[modulo]}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Aparecem aqui de proposito: esconder mostraria um sistema a menos do que a empresa
            tem, e voce nao saberia o que pedir.
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
