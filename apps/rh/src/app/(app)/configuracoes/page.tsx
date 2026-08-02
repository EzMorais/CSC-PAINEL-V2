import { ExternalLink, Users } from 'lucide-react'
import { ListaCargos } from '@/components/configuracoes/lista-cargos'
import { listarCargos } from '@/queries/cargos'
import { exigirSessao } from '@/lib/auth'

export const metadata = { title: 'Configurações — RH e SST' }
export const dynamic = 'force-dynamic'

/** Onde o Portal responde — é lá que se cadastra usuário agora. */
const URL_PORTAL = process.env.NEXT_PUBLIC_URL_PORTAL ?? 'http://localhost:3004'

export default async function ConfiguracoesPage() {
  await exigirSessao()
  const cargos = await listarCargos()

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cargos dos funcionários</p>
      </header>

      <ListaCargos cargos={cargos} />

      <section className="rounded-lg border border-dashed border-border p-4">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Usuários do sistema ficam no Portal.</p>
            <p className="mt-1">
              Quem entra no RH, no Almoxarifado, no Painel e na Frota é cadastrado uma vez só,
              no Portal — antes eram quatro cadastros separados, e um cargo mudado num lugar
              ficava velho nos outros.
            </p>
            <p className="mt-2">
              Repare que <strong>cargo</strong> aqui em cima é outra coisa: é a função do
              funcionário na obra (pedreiro, soldador), que puxa exigência de EPI e exame. O
              cargo de <em>sistema</em> — quem lança, quem aprova — é o do Portal.
            </p>
            <a
              href={`${URL_PORTAL}/usuarios`}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <ExternalLink className="size-4" /> Abrir usuários no Portal
            </a>
          </div>
        </div>
      </section>

      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Prazos de alerta (hoje fixos em 30 dias para treinamento e exame) ainda não têm tela
        própria — é a próxima peça planejada para esta seção.
      </p>
    </div>
  )
}
