'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'

export type CampoCadastro = {
  nome: string
  rotulo: string
  obrigatorio?: boolean
  dica?: string
}

export type LinhaCadastro = {
  id: string
  ativo: boolean
  valores: Record<string, string>
  usos: number
  colunas: string[]
}

type Props = {
  titulo: string
  campos: CampoCadastro[]
  linhas: LinhaCadastro[]
  cabecalhos: string[]
  aoSalvar: (id: string | null, dados: Record<string, string>) => Promise<{ ok: boolean; erro?: string }>
  aoAlternar: (id: string, ativo: boolean) => Promise<{ ok: boolean; erro?: string }>
}

export function TabelaCadastro({ titulo, campos, linhas, cabecalhos, aoSalvar, aoAlternar }: Props) {
  const [editando, setEditando] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function salvar(id: string | null, formData: FormData) {
    setErro(null)
    const dados = Object.fromEntries(campos.map((c) => [c.nome, String(formData.get(c.nome) ?? '')]))
    iniciar(async () => {
      const r = await aoSalvar(id, dados)
      if (!r.ok) return setErro(r.erro ?? 'Falha ao salvar')
      setEditando(null); setCriando(false)
    })
  }

  function alternar(id: string, ativo: boolean) {
    setErro(null)
    iniciar(async () => {
      const r = await aoAlternar(id, ativo)
      if (!r.ok) setErro(r.erro ?? 'Falha ao alterar')
    })
  }

  const campoClasse = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

  // Função que devolve JSX, não componente: declarar um componente aqui dentro
  // o remonta a cada render e apaga o que o usuário já tinha digitado (os campos
  // são não-controlados, com defaultValue). Chamar como formulario(...) mantém
  // o JSX inline, sem fiber próprio.
  const formulario = (id: string | null, valores?: Record<string, string>) => (
    <form action={(fd) => salvar(id, fd)} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map((c) => (
          <div key={c.nome}>
            <label htmlFor={`${id ?? 'novo'}-${c.nome}`} className="mb-1 block text-sm font-medium">
              {c.rotulo}{c.obrigatorio ? ' *' : ''}
            </label>
            <input
              id={`${id ?? 'novo'}-${c.nome}`} name={c.nome} required={c.obrigatorio}
              defaultValue={valores?.[c.nome] ?? ''} className={campoClasse}
            />
            {c.dica && <p className="mt-1 text-xs text-muted-foreground">{c.dica}</p>}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pendente}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Salvar
        </button>
        <button type="button" onClick={() => { setEditando(null); setCriando(false); setErro(null) }}
                className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
      </div>
    </form>
  )

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        {!criando && (
          <button type="button" onClick={() => { setCriando(true); setEditando(null) }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="size-4" /> Novo
          </button>
        )}
      </header>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {criando && formulario(null)}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              {cabecalhos.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
              <th className="px-3 py-2 text-right font-medium">Locações</th>
              <th className="px-3 py-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className={`border-b border-border/50 ${l.ativo ? '' : 'opacity-50'}`}>
                {l.colunas.map((v, i) => <td key={i} className="px-3 py-2">{v || '—'}</td>)}
                <td className="px-3 py-2 text-right tabular">{l.usos}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => { setEditando(l.id); setCriando(false) }}
                          className="mr-3 text-xs text-primary hover:underline">Editar</button>
                  <button type="button" onClick={() => alternar(l.id, !l.ativo)} disabled={pendente}
                          className="text-xs text-muted-foreground hover:underline">
                    {l.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && formulario(editando, linhas.find((l) => l.id === editando)?.valores)}
    </div>
  )
}
