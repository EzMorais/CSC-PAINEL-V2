import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { exigirSessao, temAcesso } from '@/lib/auth'
import { podeLancar, MODULO } from '@/lib/dominio/cargos'
import { CONFIG_TIPO, TIPOS_EM_ORDEM, TIPO_CADASTRO, ehTipoValido } from '@/lib/dominio/cadastros'
import { listarPorTipo, contagemPorTipo } from '@/queries/cadastros'
import { ListaCadastros } from '@/components/cadastros/lista-cadastros'
import { IlustracaoCadastros } from '@/components/marca/ilustracoes'

export const metadata = { title: 'Cadastros — Construtora Siqueira Campos' }
export const dynamic = 'force-dynamic'

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const sessao = await exigirSessao()
  if (!temAcesso(sessao, MODULO.CADASTROS)) redirect('/')

  const { tipo: pedido = '' } = await searchParams
  const tipo = ehTipoValido(pedido) ? pedido : TIPO_CADASTRO.OBRA

  const [itens, contagem] = await Promise.all([listarPorTipo(tipo), contagemPorTipo()])
  const config = CONFIG_TIPO[tipo]

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header className="flex items-center gap-4 overflow-hidden rounded-xl bg-gradient-to-r from-marca-azul-fundo to-marca-azul-fundo-claro p-5 text-white shadow-sm">
        <IlustracaoCadastros className="hidden size-16 shrink-0 sm:block" />
        <div className="min-w-0">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/75 hover:text-white">
            <ArrowLeft className="size-3.5" /> Voltar ao Portal
          </Link>
          <h1 className="mt-1.5 text-2xl font-semibold">Cadastros</h1>
          <p className="mt-1 text-sm text-white/85">
            O catálogo da empresa: obras, casas, veículos, máquinas e materiais num lugar só.
          </p>
        </div>
      </header>

      <nav aria-label="Tipos de cadastro" className="flex flex-wrap gap-2">
        {TIPOS_EM_ORDEM.map((t) => {
          const atual = t === tipo
          return (
            <Link
              key={t}
              href={`/cadastros?tipo=${t}`}
              aria-current={atual ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                atual
                  ? 'border-marca-azul-fundo bg-marca-azul-fundo text-white font-medium'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {CONFIG_TIPO[t].rotuloPlural}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] tabular ${
                  atual ? 'bg-white/20' : 'bg-muted'
                }`}
              >
                {contagem[t]}
              </span>
            </Link>
          )
        })}
      </nav>

      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">{config.descricao}</p>
        <ListaCadastros tipo={tipo} itens={itens} podeEditar={podeLancar(sessao.cargo)} />
      </section>

      <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Este catálogo é do Portal e <strong>não substitui</strong> os cadastros que cada
        sistema já tem — o Almoxarifado continua dono dos materiais que movimenta, a Frota
        dos veículos que abastece. Aqui fica a lista da empresa, para consulta e para todo
        mundo usar o mesmo código e o mesmo nome.
      </p>
    </div>
  )
}
