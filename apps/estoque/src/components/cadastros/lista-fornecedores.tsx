'use client'

import { chamarAction } from '@/lib/chamar-action'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { alternarAtivoFornecedor, criarFornecedor } from '@/actions/cadastros'
import type { FornecedorListado } from '@/queries/movimentacoes'

const CAMPO =
  'rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

function LinhaFornecedor({ fornecedor }: { fornecedor: FornecedorListado }) {
  const [ativo, setAtivo] = useState(fornecedor.ativo)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 ${!ativo ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{fornecedor.nome}</p>
        <p className="text-xs text-muted-foreground">
          {fornecedor.cnpj && <>{fornecedor.cnpj}</>}
          {fornecedor.telefone && <>{fornecedor.cnpj ? ' · ' : ''}{fornecedor.telefone}</>}
          {fornecedor.email && <>{fornecedor.cnpj || fornecedor.telefone ? ' · ' : ''}{fornecedor.email}</>}
          {!fornecedor.cnpj && !fornecedor.telefone && !fornecedor.email && <>sem contato cadastrado</>}
        </p>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>

      <label className="inline-flex shrink-0 items-center gap-2 text-sm">
        <input
          type="checkbox" checked={ativo} disabled={pendente}
          onChange={(e) => {
            const proximo = e.target.checked
            setAtivo(proximo)
            setErro(null)
            iniciar(async () => {
              const r = await chamarAction(alternarAtivoFornecedor(fornecedor.id, proximo))
              if (!r.ok) { setErro(r.erro); setAtivo(!proximo) }
            })
          }}
        />
        {ativo ? 'Ativo' : 'Inativo'}
      </label>
    </li>
  )
}

export function ListaFornecedores({ fornecedores }: { fornecedores: FornecedorListado[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(criarFornecedor(Object.fromEntries(fd.entries())))
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
      form.reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Fornecedores</h2>
        {!criando && (
          <button
            type="button" onClick={() => setCriando(true)} data-testid="novo-fornecedor"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Novo fornecedor
          </button>
        )}
      </div>

      {criando && (
        <form onSubmit={aoSubmeter} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="nome" placeholder="Nome do fornecedor" required autoFocus className={CAMPO} />
            <input name="cnpj" placeholder="CNPJ" className={CAMPO} />
            <input name="telefone" placeholder="Telefone" className={CAMPO} />
            <input name="email" type="email" placeholder="E-mail" className={CAMPO} />
          </div>
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-fornecedor"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Criando…' : 'Criar fornecedor'}
            </button>
            <button type="button" onClick={() => { setCriando(false); setErro(null) }} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {fornecedores.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum fornecedor cadastrado.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm" data-testid="lista-fornecedores">
          {fornecedores.map((f) => <LinhaFornecedor key={f.id} fornecedor={f} />)}
        </ul>
      )}
    </div>
  )
}
