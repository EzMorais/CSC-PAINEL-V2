import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { SeloSituacao, SeloMovimentacao } from '@/components/selo'
import { PainelInventario } from '@/components/materiais/painel-inventario'
import { obterMaterial } from '@/queries/materiais'
import {
  ROTULO_CATEGORIA_MATERIAL, SINAL_MOVIMENTACAO,
  type CategoriaMaterial, type TipoMovimentacao,
} from '@/lib/dominio/constantes'
import { brl, dataBR } from '@/lib/dominio/formato'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const m = await obterMaterial(id)
  return { title: m ? `${m.nome} — Almoxarifado` : 'Material — Almoxarifado' }
}

export default async function MaterialPage({ params }: Props) {
  const { id } = await params
  const material = await obterMaterial(id)
  if (!material) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/materiais" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Materiais
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold" data-testid="nome-material">{material.nome}</h1>
          <Link
            href={`/materiais/${material.id}/editar`}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <Pencil className="size-4" /> Editar
          </Link>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="tabular">{material.codigo}</span>
          <span>{ROTULO_CATEGORIA_MATERIAL[material.categoria as CategoriaMaterial] ?? material.categoria}</span>
          {material.localizacao && <span>{material.localizacao}</span>}
          {!material.ativo && <span className="text-destructive">Inativo</span>}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Extrato" className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo atual</p>
              <p className="mt-1 text-3xl font-semibold tabular" data-testid="saldo">
                {material.saldo} <span className="text-lg text-muted-foreground">{material.unidade}</span>
              </p>
            </div>
            <SeloSituacao situacao={material.situacao} />
            {material.estoqueMinimo > 0 && (
              <p className="text-xs text-muted-foreground">
                Mínimo cadastrado: <span className="tabular">{material.estoqueMinimo} {material.unidade}</span>
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Extrato de movimentações</h2>
            {material.movimentacoes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2" data-testid="extrato">
                {material.movimentacoes.map((m) => {
                  const sinal = SINAL_MOVIMENTACAO[m.tipo as TipoMovimentacao] ?? 0
                  return (
                    <li key={m.id} className="border-b border-border/50 pb-2 last:border-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <SeloMovimentacao tipo={m.tipo} />
                        <span className={`text-sm tabular font-medium ${sinal > 0 ? 'text-status-ativa' : 'text-status-atencao'}`}>
                          {sinal > 0 ? '+' : '−'}{m.quantidade} {material.unidade}
                        </span>
                        <span className="text-xs tabular text-muted-foreground">{dataBR(m.ocorridoEm)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {m.obra && <>Obra {m.obra.codigo} · </>}
                        {m.fornecedor && <>{m.fornecedor.nome} · </>}
                        {m.valorUnitario != null && <>{brl(m.valorUnitario)}/{material.unidade} · </>}
                        {m.documento && <>Doc. {m.documento} · </>}
                        {m.registradoPor && <>por {m.registradoPor}</>}
                      </p>
                      {m.observacao && <p className="mt-0.5 text-xs text-muted-foreground">{m.observacao}</p>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <PainelInventario
            materialId={material.id}
            unidade={material.unidade}
            saldo={material.saldo}
            ativo={material.ativo}
          />

          {material.observacao && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-medium">Observação</h2>
              <p className="mt-2 text-sm text-muted-foreground">{material.observacao}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
