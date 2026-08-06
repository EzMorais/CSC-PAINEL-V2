import { TabelaCadastro } from '@/components/cadastro/tabela-cadastro'
import { alternarObra, listarObras, salvarObra } from '@/actions/obras'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Obras — Painel SC' }

export default async function ObrasPage() {
  const obras = await listarObras()

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <TabelaCadastro
        titulo="Obras"
        cabecalhos={['Cliente', 'Código', 'Descrição', 'Responsável', 'Aba na planilha']}
        campos={[
          { nome: 'cliente', rotulo: 'Cliente', obrigatorio: true },
          { nome: 'codigo', rotulo: 'Código da obra', obrigatorio: true, dica: 'Ex.: SC-1017-26' },
          { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true },
          { nome: 'responsavel', rotulo: 'Responsável' },
          {
            nome: 'abaOrigem', rotulo: 'Aba de origem (planilha)',
            dica: 'Nome exato da aba na planilha de importação, ex.: SC-1060-25_CLARIOS. Em branco, usa o código da obra.',
          },
        ]}
        linhas={obras.map((o) => ({
          id: o.id,
          ativo: o.ativa,
          usos: o._count.locacoes,
          colunas: [o.cliente, o.codigo, o.descricao, o.responsavel ?? '', o.abaOrigem],
          valores: {
            cliente: o.cliente, codigo: o.codigo,
            descricao: o.descricao, responsavel: o.responsavel ?? '',
            abaOrigem: o.abaOrigem,
          },
        }))}
        aoSalvar={async (id, dados) => {
          'use server'
          const r = await salvarObra(id, dados)
          return r.ok ? { ok: true } : { ok: false, erro: r.erro }
        }}
        aoAlternar={async (id, ativo) => {
          'use server'
          const r = await alternarObra(id, ativo)
          return r.ok ? { ok: true } : { ok: false, erro: r.erro }
        }}
      />
    </div>
  )
}
