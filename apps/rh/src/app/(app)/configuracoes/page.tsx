import { ListaCargos } from '@/components/configuracoes/lista-cargos'
import { ListaUsuarios } from '@/components/configuracoes/lista-usuarios'
import { listarCargos } from '@/queries/cargos'
import { listarUsuarios } from '@/queries/usuarios'
import { exigirSessao } from '@/lib/auth'

export const metadata = { title: 'Configurações — RH e SST' }
export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const sessao = await exigirSessao()
  const [cargos, usuarios] = await Promise.all([listarCargos(), listarUsuarios()])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cargos e usuários</p>
      </header>

      <ListaCargos cargos={cargos} />
      <ListaUsuarios usuarios={usuarios} meuId={sessao.id} />

      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Prazos de alerta (hoje fixos em 30 dias para treinamento e exame) ainda não têm tela
        própria — é a próxima peça planejada para esta seção.
      </p>
    </div>
  )
}
