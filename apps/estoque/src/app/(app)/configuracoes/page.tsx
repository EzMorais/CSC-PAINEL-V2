import { FormEmail } from '@/components/configuracoes/form-email'
import { carregarConfiguracaoEmail } from '@/queries/configuracao'

export const metadata = { title: 'Configurações — Almoxarifado' }
export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const config = await carregarConfiguracaoEmail()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conta de e-mail que dispara as solicitações de compra
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Vincular uma conta é opcional.</p>
        <p className="mt-1">
          Sem conta vinculada, a tela da solicitação continua oferecendo os botões que abrem o
          Gmail, o Outlook ou o app de e-mail com o pedido já escrito — você só aperta enviar.
          Vinculando a conta aqui, o pedido sai sozinho assim que for criado, sem passar pelo
          navegador.
        </p>
      </div>

      <FormEmail config={config} />
    </div>
  )
}
