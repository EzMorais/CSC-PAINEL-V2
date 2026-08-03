import { Building2, Users, Package, House, Truck, ArrowUpRight, Lock, ShieldCheck } from 'lucide-react'
import { exigirSessao, temAcesso } from '@/lib/auth'
import {
  MODULO, ROTULO_MODULO, URL_MODULO, ROTULO_CARGO, DESCRICAO_CARGO, TOM_CARGO,
  podeAprovar, podeLancar, type Cargo, type Modulo,
} from '@/lib/dominio/cargos'

export const metadata = { title: 'Portal — Siqueira Campos' }
export const dynamic = 'force-dynamic'

const COR_TOM: Record<string, string> = {
  ativa: 'bg-status-ativa/15 text-status-ativa',
  atencao: 'bg-status-atencao/15 text-status-atencao',
  vencida: 'bg-status-vencida/15 text-status-vencida',
  devolvida: 'bg-status-devolvida/15 text-status-devolvida',
}

const SISTEMAS: Array<{
  modulo: Modulo
  descricao: string
  Icone: typeof Building2
}> = [
  { modulo: MODULO.PAINEL,  descricao: 'Equipamentos alugados por obra, vencimentos e custo',  Icone: Building2 },
  { modulo: MODULO.RH,      descricao: 'Funcionários, treinamentos, exames, EPIs e documentos', Icone: Users },
  { modulo: MODULO.ESTOQUE, descricao: 'Materiais, entradas e saídas por obra, compras',        Icone: Package },
  { modulo: MODULO.ALOJAMENTOS, descricao: 'Moradia dos funcionários, pedidos e programação',   Icone: House },
  { modulo: MODULO.FROTA,   descricao: 'Veículos, manutenções e abastecimento',                 Icone: Truck },
]

export default async function PortalPage() {
  const sessao = await exigirSessao()
  const cargo = sessao.cargo as Cargo

  const liberados = SISTEMAS.filter((s) => temAcesso(sessao, s.modulo))
  const bloqueados = SISTEMAS.filter((s) => !temAcesso(sessao, s.modulo))

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Olá, {sessao.nome.split(' ')[0]}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_TOM[TOM_CARGO[cargo] ?? 'devolvida']}`}>
            {ROTULO_CARGO[cargo] ?? cargo}
          </span>
          {DESCRICAO_CARGO[cargo]}
        </p>
      </header>

      <section aria-label="Sistemas">
        <h2 className="text-sm font-medium">Seus sistemas</h2>
        {liberados.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Você ainda não tem acesso a nenhum sistema. Peça ao administrador para liberar.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {liberados.map(({ modulo, descricao, Icone }) => (
              <a
                key={modulo} href={URL_MODULO[modulo]} data-testid={`sistema-${modulo}`}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm
                           transition-all hover:-translate-y-0.5 hover:bg-accent hover:shadow-md"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icone className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-medium">
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

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-muted-foreground" /> O que o seu cargo permite
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <Marca ativo={podeLancar(cargo)} />
            Lançar no dia a dia (cadastrar, movimentar, registrar)
          </li>
          <li className="flex items-center gap-2">
            <Marca ativo={podeAprovar(cargo)} />
            Aprovar o que outra pessoa lançou
          </li>
          <li className="flex items-center gap-2">
            <Marca ativo={cargo === 'ADMIN'} />
            Cadastrar usuários e definir cargos
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Quem lança não aprova o próprio lançamento — é isso que faz a aprovação valer
          alguma coisa. Por isso o cargo Operacional não aprova.
        </p>
      </section>
    </div>
  )
}

function Marca({ ativo }: { ativo: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
        ativo ? 'bg-status-ativa/20 text-status-ativa' : 'bg-muted text-muted-foreground'
      }`}
    >
      {ativo ? '✓' : '—'}
    </span>
  )
}
