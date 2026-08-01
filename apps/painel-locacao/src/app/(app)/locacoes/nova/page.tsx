import { FormLocacao } from '@/components/locacoes/form-locacao'
import { opcoesDeFiltro } from '@/queries/locacoes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Nova locação — Painel SC' }

export default async function NovaLocacaoPage() {
  const { obras, fornecedores } = await opcoesDeFiltro()
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Nova locação</h1>
      <FormLocacao obras={obras} fornecedores={fornecedores} />
    </div>
  )
}
