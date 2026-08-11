import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, PlugZap, RefreshCw } from 'lucide-react'
import { exigirSessao, temAcesso } from '@/lib/auth'
import { resumosDosModulos, type ResumoModulo, type Tom } from '@/lib/clientes-modulos'
import { MODULO, type Modulo } from '@/lib/dominio/cargos'
import {
  IlustracaoLocacao, IlustracaoRh, IlustracaoEstoque, IlustracaoFrota, IlustracaoAlojamentos,
} from '@/components/marca/ilustracoes'

export const metadata = { title: 'Dashboard geral - Construtora Siqueira Campos' }
export const dynamic = 'force-dynamic'

const ILUSTRACAO: Partial<Record<Modulo, typeof IlustracaoLocacao>> = {
  [MODULO.PAINEL]: IlustracaoLocacao,
  [MODULO.RH]: IlustracaoRh,
  [MODULO.ESTOQUE]: IlustracaoEstoque,
  [MODULO.ALOJAMENTOS]: IlustracaoAlojamentos,
  [MODULO.FROTA]: IlustracaoFrota,
}

const COR_TOM: Record<Tom, string> = {
  destaque: 'border-marca-azul/30 bg-marca-azul/10 text-marca-azul',
  bom: 'border-status-ativa/30 bg-status-ativa/10 text-status-ativa',
  alerta: 'border-status-atencao/30 bg-status-atencao/10 text-status-atencao',
  perigo: 'border-marca-vermelho/30 bg-marca-vermelho/10 text-marca-vermelho',
  neutro: 'border-border bg-muted/40 text-foreground',
}

export default async function DashboardPage() {
  const sessao = await exigirSessao()
  const resumos = await resumosDosModulos((m) => temAcesso(sessao, m))

  const noAr = resumos.filter((r) => r.ok).length
  const fora = resumos.filter((r) => !r.ok)

  return (
    <div className="page-shell mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="surface-hero rounded-sm p-5 text-white sm:p-6">
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/75 hover:text-white">
            <ArrowLeft className="size-3.5" /> Voltar ao Portal
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard geral</h1>
          <p className="mt-1 text-sm text-white/85">
            Os numeros de cada sistema, buscados agora. {noAr} de {resumos.length} responderam.
          </p>
        </div>
      </header>

      {resumos.length === 0 && (
        <p className="surface-card rounded-sm border-dashed p-8 text-center text-sm text-muted-foreground">
          Voce ainda nao tem acesso a nenhum sistema, entao nao ha numero para reunir aqui.
        </p>
      )}

      <div className="space-y-4">
        {resumos.map((r) => <CartaoModulo key={r.modulo} resumo={r} />)}
      </div>

      {fora.length > 0 && (
        <p className="surface-card flex items-start gap-2 rounded-sm border-dashed p-3 text-xs text-muted-foreground">
          <PlugZap className="mt-0.5 size-4 shrink-0" />
          <span>
            Um sistema fora do ar aparece com o aviso, e nao some da lista: sumir daria a
            entender que a empresa nao tem aquele modulo. Cada um roda no seu proprio
            servidor - e normal so os que estao em uso estarem ligados.
          </span>
        </p>
      )}
    </div>
  )
}

function CartaoModulo({ resumo }: { resumo: ResumoModulo }) {
  const Ilustracao = ILUSTRACAO[resumo.modulo]

  return (
    <section className="surface-card overflow-hidden rounded-sm">
      <div className="flex items-center gap-3 border-b-2 border-black/10 bg-muted/30 px-4 py-3">
        {Ilustracao && <Ilustracao className="size-10 shrink-0" />}
        <h2 className="min-w-0 flex-1 font-semibold uppercase tracking-[0.08em]">{resumo.rotulo}</h2>
        <a
          href={resumo.url}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm border-2 border-black/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Abrir <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      {resumo.ok ? (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4">
          {resumo.indicadores.map((i) => (
            <div key={i.rotulo} className={`rounded-sm border-2 p-3 ${COR_TOM[i.tom] ?? COR_TOM.neutro}`}>
              <p className="text-[11px] font-medium uppercase leading-none tracking-wide opacity-80">
                {i.rotulo}
              </p>
              <p className="mt-1.5 truncate text-xl font-semibold tabular" title={i.valor}>{i.valor}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
          <RefreshCw className="size-4 shrink-0" />
          Este sistema {resumo.erro}. Ligue o servidor dele e recarregue a pagina.
        </p>
      )}
    </section>
  )
}
