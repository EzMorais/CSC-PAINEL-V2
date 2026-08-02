import { ListaObras } from '@/components/cadastros/lista-obras'
import { listarObras } from '@/queries/movimentacoes'
import { consumoPorObra } from '@/queries/dashboard'

export const metadata = { title: 'Obras — Almoxarifado' }
export const dynamic = 'force-dynamic'

export default async function ObrasPage() {
  const [obras, consumos] = await Promise.all([listarObras(), consumoPorObra()])

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Obras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para onde o material sai, e quanto cada uma já consumiu
        </p>
      </header>

      <ListaObras obras={obras} consumos={consumos} />
    </div>
  )
}
