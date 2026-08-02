'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search, Paperclip } from 'lucide-react'
import {
  TIPO_EXAME, ROTULO_TIPO_EXAME, ROTULO_RESULTADO_EXAME,
  type TipoExame, type ResultadoExame,
} from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import type { ExameListado } from '@/queries/exames'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

const COR_RESULTADO: Record<string, string> = {
  APTO: 'bg-status-ativa/15 text-status-ativa',
  INAPTO: 'bg-status-vencida/15 text-status-vencida',
  APTO_COM_RESTRICAO: 'bg-status-atencao/15 text-status-atencao',
}

function SeloResultado({ resultado }: { resultado: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COR_RESULTADO[resultado] ?? ''}`}>
      {ROTULO_RESULTADO_EXAME[resultado as ResultadoExame] ?? resultado}
    </span>
  )
}

export function ListaExames({ linhas }: { linhas: ExameListado[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')
  const tipoAtual = params.get('tipo') ?? ''

  function aplicar(novos: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    router.push(`/exames${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); aplicar({ busca }) }}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou matrícula" aria-label="Buscar exame"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
        </form>
        <select value={tipoAtual} onChange={(e) => aplicar({ tipo: e.target.value })} aria-label="Filtrar por tipo" className={`${CAMPO} w-auto`}>
          <option value="">Todos os tipos</option>
          {Object.values(TIPO_EXAME).map((t: TipoExame) => <option key={t} value={t}>{ROTULO_TIPO_EXAME[t]}</option>)}
        </select>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="contagem-exames">
        {linhas.length} exame{linhas.length === 1 ? '' : 's'}
      </p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum exame registrado.
        </p>
      ) : (
        <>
          <ul data-testid="lista-cards-exames" className="space-y-2 lg:hidden">
            {linhas.map((e) => (
              <li key={e.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{e.funcionario.nome}</span>
                  <SeloResultado resultado={e.resultado} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="tabular">{e.funcionario.matricula}</span> · {ROTULO_TIPO_EXAME[e.tipo as TipoExame] ?? e.tipo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dataBR(e.realizadoEm)}{e.validadeEm && <> · válido até {dataBR(e.validadeEm)}</>}
                  {e.arquivo && <> · <Paperclip className="inline size-3" /></>}
                </p>
              </li>
            ))}
          </ul>

          <div data-testid="tabela-exames" className="hidden overflow-x-auto rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Funcionário</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Realizado</th>
                  <th className="px-3 py-2 font-medium">Válido até</th>
                  <th className="px-3 py-2 font-medium">Resultado</th>
                  <th className="px-3 py-2 font-medium">ASO</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="font-medium">{e.funcionario.nome}</span>
                      <span className="block text-xs tabular text-muted-foreground">{e.funcionario.matricula}</span>
                    </td>
                    <td className="px-3 py-2">{ROTULO_TIPO_EXAME[e.tipo as TipoExame] ?? e.tipo}</td>
                    <td className="px-3 py-2 tabular">{dataBR(e.realizadoEm)}</td>
                    <td className="px-3 py-2 tabular">{e.validadeEm ? dataBR(e.validadeEm) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2"><SeloResultado resultado={e.resultado} /></td>
                    <td className="px-3 py-2">
                      {e.arquivo
                        ? <a href={e.arquivo} download={`aso-${e.funcionario.matricula}`} className="text-primary hover:underline">Ver</a>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
