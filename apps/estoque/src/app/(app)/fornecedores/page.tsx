import { ListaFornecedores } from '@/components/cadastros/lista-fornecedores'
import { listarFornecedores } from '@/queries/movimentacoes'

export const metadata = { title: 'Fornecedores — Almoxarifado' }
export const dynamic = 'force-dynamic'

export default async function FornecedoresPage() {
  const fornecedores = await listarFornecedores()

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Fornecedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">De quem o almoxarifado compra</p>
      </header>

      <ListaFornecedores fornecedores={fornecedores} />
    </div>
  )
}
