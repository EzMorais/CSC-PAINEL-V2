'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { ROTULO_STATUS, STATUS, TOM_STATUS, type Status } from '@/lib/dominio/constantes'
import { formatarCpf } from '@/lib/dominio/cpf'
import { dataBR } from '@/lib/dominio/formato'

export type LinhaFuncionario = {
  id: string
  matricula: string
  nome: string
  cpf: string
  status: string
  admitidoEm: Date
  obra: { codigo: string; descricao: string } | null
  cargo: { nome: string } | null
}

const COR_TOM: Record<string, string> = {
  ativa: 'bg-status-ativa/15 text-status-ativa',
  atencao: 'bg-status-atencao/15 text-status-atencao',
  vencida: 'bg-status-vencida/15 text-status-vencida',
  devolvida: 'bg-status-devolvida/15 text-status-devolvida',
}

function Selo({ status }: { status: string }) {
  const tom = TOM_STATUS[status as Status] ?? 'devolvida'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COR_TOM[tom]}`}>
      {ROTULO_STATUS[status as Status] ?? status}
    </span>
  )
}

export function ListaFuncionarios({ linhas }: { linhas: LinhaFuncionario[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')

  const statusAtual = params.get('status') ?? ''

  function aplicar(novos: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(novos)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    router.push(`/funcionarios${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => { e.preventDefault(); aplicar({ busca }) }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, matrícula ou CPF"
              aria-label="Buscar funcionário"
              data-testid="busca"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm
                         outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
        </form>

        <select
          value={statusAtual}
          onChange={(e) => aplicar({ status: e.target.value })}
          aria-label="Filtrar por situação"
          data-testid="filtro-status"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todas as situações</option>
          {Object.values(STATUS).map((s) => (
            <option key={s} value={s}>{ROTULO_STATUS[s as Status]}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="contagem">
        {linhas.length} funcionário{linhas.length === 1 ? '' : 's'}
      </p>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum funcionário encontrado.
        </p>
      ) : (
        <>
          {/* Cards no celular e tablet; tabela no desktop. Os dois existem no DOM ao
              mesmo tempo — o CSS decide qual aparece, como no Painel de Locação. */}
          <ul data-testid="lista-cards" className="space-y-2 lg:hidden">
            {linhas.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/funcionarios/${f.id}`}
                  className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{f.nome}</span>
                    <Selo status={f.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="tabular">{f.matricula}</span>
                    {f.cargo && <> · {f.cargo.nome}</>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.obra ? `${f.obra.codigo} — ${f.obra.descricao}` : 'Sem obra'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div data-testid="tabela-funcionarios" className="hidden overflow-x-auto rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Matrícula</th>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">CPF</th>
                  <th className="px-3 py-2 font-medium">Cargo</th>
                  <th className="px-3 py-2 font-medium">Obra</th>
                  <th className="px-3 py-2 font-medium">Admissão</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((f) => (
                  <tr key={f.id} className="border-t border-border transition-colors hover:bg-accent">
                    <td className="px-3 py-2 tabular">
                      <Link href={`/funcionarios/${f.id}`} className="hover:underline">{f.matricula}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/funcionarios/${f.id}`} className="font-medium hover:underline">{f.nome}</Link>
                    </td>
                    <td className="px-3 py-2 tabular text-muted-foreground">{formatarCpf(f.cpf)}</td>
                    <td className="px-3 py-2">{f.cargo?.nome ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2">{f.obra?.codigo ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 tabular">{dataBR(f.admitidoEm)}</td>
                    <td className="px-3 py-2"><Selo status={f.status} /></td>
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
