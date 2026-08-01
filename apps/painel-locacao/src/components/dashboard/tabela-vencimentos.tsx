import Link from 'next/link'
import { calcularStatus, rotuloVencimento } from '@/lib/dominio/status'
import { brl, dataBR } from '@/lib/dominio/formato'

type Item = {
  id: string
  descricao: string
  trCodigo: string | null
  dataFim: Date | null
  valorItem: number | null
  obra: { codigo: string; cliente: string }
  fornecedor: { nome: string } | null
}

const CLASSE_STATUS: Record<string, string> = {
  VENCIDA: 'text-status-vencida',
  ATENCAO: 'text-status-atencao',
  ATIVA: 'text-status-ativa',
  SEM_PRAZO: 'text-muted-foreground',
  DEVOLVIDA: 'text-muted-foreground',
}

export function TabelaVencimentos({ itens, total }: { itens: Item[]; total?: number }) {
  if (!itens.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Nada vencendo nos próximos 7 dias.</p>
  }

  // A consulta corta em 25. Sem dizer o tamanho real, o gestor lê a tabela como
  // "são estes 25" quando há 125 — e para de procurar o resto.
  const truncada = total !== undefined && total > itens.length

  return (
    <>
      <div className="overflow-x-auto">
        {/* A coluna "Fim" some no celular: a data crua é a mesma informação que
            "vencida há 18 dias", e é ela que precisa caber. Com as quatro colunas a
            390px a situação era empurrada para fora da área visível — a tabela
            rolava para o lado escondendo justamente a coluna que motiva a tela. */}
        <table className="w-full min-w-[300px] text-sm sm:min-w-[520px]">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Equipamento</th>
              <th className="py-2 pr-4 font-medium">Obra</th>
              <th className="hidden py-2 pr-4 font-medium sm:table-cell">Fim</th>
              <th className="py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const status = calcularStatus({ dataFim: i.dataFim, devolvidaEm: null })
              return (
                <tr key={i.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4">
                    <Link href={`/locacoes?item=${i.id}`} className="font-medium hover:underline">
                      {i.descricao}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {i.trCodigo ? `Tr ${i.trCodigo}` : 'sem Tr'}
                      {i.fornecedor ? ` · ${i.fornecedor.nome}` : ''}
                      {i.valorItem ? ` · ${brl(i.valorItem)}` : ''}
                    </p>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{i.obra.codigo}</td>
                  <td className="hidden py-2.5 pr-4 tabular text-xs sm:table-cell">{dataBR(i.dataFim)}</td>
                  <td className={`py-2.5 text-xs font-medium ${CLASSE_STATUS[status]}`}>
                    {rotuloVencimento(i.dataFim)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {truncada && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Mostrando os {itens.length} mais urgentes de {total} itens vencidos ou vencendo até 7 dias.
          Ver a lista completa em{' '}
          <Link href="/locacoes?status=VENCIDA" className="font-medium text-foreground underline">
            vencidos
          </Link>{' '}
          e{' '}
          <Link href="/locacoes?status=ATENCAO" className="font-medium text-foreground underline">
            vencem em 7 dias
          </Link>.
        </p>
      )}
    </>
  )
}
