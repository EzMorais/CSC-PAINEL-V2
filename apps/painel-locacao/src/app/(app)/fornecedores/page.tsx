import { TabelaCadastro } from '@/components/cadastro/tabela-cadastro'
import { alternarFornecedor, listarFornecedores, salvarFornecedor } from '@/actions/fornecedores'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Fornecedores — Painel SC' }

export default async function FornecedoresPage() {
  const fornecedores = await listarFornecedores()

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Os apelidos existem para a importação: se a planilha escreve <code>MAQLOC</code> e o cadastro
        diz <code>MAQLOC LOCAÇÕES</code>, o apelido faz os dois virarem o mesmo fornecedor em vez de dois.
      </p>

      <TabelaCadastro
        titulo="Fornecedores"
        cabecalhos={['Nome', 'Telefone', 'Apelidos']}
        campos={[
          { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
          { nome: 'telefone', rotulo: 'Telefone' },
          { nome: 'aliases', rotulo: 'Apelidos', dica: 'Separados por vírgula. Ex.: MAQLOC, MAQ LOC' },
        ]}
        linhas={fornecedores.map((f) => ({
          id: f.id,
          ativo: f.ativo,
          usos: f._count.locacoes,
          colunas: [f.nome, f.telefone ?? '', f.aliases.map((a) => a.alias).join(', ')],
          valores: {
            nome: f.nome, telefone: f.telefone ?? '',
            aliases: f.aliases.map((a) => a.alias).join(', '),
          },
        }))}
        aoSalvar={async (id, dados) => {
          'use server'
          const r = await salvarFornecedor(id, dados)
          return r.ok ? { ok: true } : { ok: false, erro: r.erro }
        }}
        aoAlternar={async (id, ativo) => {
          'use server'
          const r = await alternarFornecedor(id, ativo)
          return r.ok ? { ok: true } : { ok: false, erro: r.erro }
        }}
      />
    </div>
  )
}
