import { prisma } from '@/lib/prisma'
import { ListaObras } from '@/components/cadastros/lista-obras'
import { mapaConfigurado } from '@/lib/geo'

export const metadata = { title: 'Obras' }
export const dynamic = 'force-dynamic'

export default async function ObrasPage() {
  const obras = await prisma.obra.findMany({ orderBy: [{ ativa: 'desc' }, { codigo: 'asc' }] })

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Obras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O endereço das obras mora aqui — é o que permite medir a distância até cada alojamento
        </p>
      </header>

      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Use o mesmo <strong>código</strong> que a obra tem no Painel de Locação e no RH. É por ele
        que os sistemas se reconhecem — escrito diferente, cada um enxerga uma obra diferente.
        {!mapaConfigurado() && (
          <> O mapa ainda não está ligado: os endereços são guardados normalmente e as
          distâncias passam a ser calculadas assim que a chave do Google Maps for cadastrada.</>
        )}
      </p>

      <ListaObras
        obras={obras.map((o) => ({
          id: o.id, codigo: o.codigo, cliente: o.cliente, descricao: o.descricao,
          endereco: o.endereco, cidade: o.cidade, uf: o.uf,
          temCoordenada: o.lat != null && o.lng != null, ativa: o.ativa,
        }))}
      />
    </div>
  )
}
