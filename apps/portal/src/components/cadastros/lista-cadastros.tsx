'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Pencil, EyeOff, Eye, Search } from 'lucide-react'
import { salvarItem, alternarAtivo } from '@/actions/cadastros'
import { CONFIG_TIPO, type TipoCadastro } from '@/lib/dominio/cadastros'
import type { ItemListado } from '@/queries/cadastros'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Rascunho = {
  codigo: string; nome: string; detalhe: string; identificador: string
  local: string; unidade: string; quantidade: string; observacao: string
}

const VAZIO: Rascunho = {
  codigo: '', nome: '', detalhe: '', identificador: '',
  local: '', unidade: '', quantidade: '', observacao: '',
}

function paraRascunho(item: ItemListado): Rascunho {
  return {
    codigo: item.codigo,
    nome: item.nome,
    detalhe: item.detalhe ?? '',
    identificador: item.identificador ?? '',
    local: item.local ?? '',
    unidade: item.unidade ?? '',
    quantidade: item.quantidade === null ? '' : String(item.quantidade),
    observacao: item.observacao ?? '',
  }
}

function Formulario({
  tipo, item, aoFechar,
}: {
  tipo: TipoCadastro
  item: ItemListado | null
  aoFechar: () => void
}) {
  const router = useRouter()
  const config = CONFIG_TIPO[tipo]
  const [dados, setDados] = useState<Rascunho>(item ? paraRascunho(item) : VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const mudar = (chave: keyof Rascunho) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDados((d) => ({ ...d, [chave]: e.target.value }))

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    iniciar(async () => {
      const r = await salvarItem(item?.id ?? null, { ...dados, tipo })
      if (!r.ok) return setErro(r.erro)
      aoFechar()
      router.refresh()
    })
  }

  return (
    <form onSubmit={submeter} className="space-y-3 rounded-xl border border-marca-azul/25 bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold">
        {item ? `Editar ${config.rotuloSingular.toLowerCase()}` : `Novo${config.rotuloSingular === 'Casa' || config.rotuloSingular === 'Máquina' || config.rotuloSingular === 'Obra' ? 'a' : ''} ${config.rotuloSingular.toLowerCase()}`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="codigo" className="mb-1 block text-sm font-medium">{config.rotuloCodigo} *</label>
          <input id="codigo" value={dados.codigo} onChange={mudar('codigo')} required autoFocus className={CAMPO} />
        </div>
        <div>
          <label htmlFor="nome" className="mb-1 block text-sm font-medium">{config.rotuloNome} *</label>
          <input id="nome" value={dados.nome} onChange={mudar('nome')} required className={CAMPO} />
        </div>

        {config.campos.map(({ campo, rotulo, dica }) => (
          <div key={campo}>
            <label htmlFor={campo} className="mb-1 block text-sm font-medium">{rotulo}</label>
            <input
              id={campo}
              value={dados[campo]}
              onChange={mudar(campo)}
              inputMode={campo === 'quantidade' ? 'decimal' : undefined}
              placeholder={dica}
              className={CAMPO}
            />
          </div>
        ))}

        <div className="sm:col-span-2">
          <label htmlFor="observacao" className="mb-1 block text-sm font-medium">Observação</label>
          <input id="observacao" value={dados.observacao} onChange={mudar('observacao')} className={CAMPO} />
        </div>
      </div>

      {erro && <p role="alert" data-testid="erro-cadastro" className="text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit" disabled={pendente} data-testid="salvar-cadastro"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={aoFechar} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Linha({
  item, tipo, podeEditar, aoEditar,
}: {
  item: ItemListado
  tipo: TipoCadastro
  podeEditar: boolean
  aoEditar: () => void
}) {
  const router = useRouter()
  const config = CONFIG_TIPO[tipo]
  const [pendente, iniciar] = useTransition()

  function alternar() {
    iniciar(async () => {
      await alternarAtivo(item.id, !item.ativo)
      router.refresh()
    })
  }

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 ${item.ativo ? '' : 'opacity-55'}`}>
      <span className="tabular shrink-0 rounded border border-marca-azul/30 bg-marca-azul/10 px-1.5 py-0.5 text-xs font-semibold text-marca-azul">
        {item.codigo}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.nome}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {config.campos
            .map(({ campo, rotulo }) => {
              const v = item[campo]
              return v === null || v === '' ? null : `${rotulo}: ${v}`
            })
            .filter(Boolean)
            .join(' · ') || 'sem detalhes'}
          {item.observacao && ` · ${item.observacao}`}
        </span>
      </span>

      {!item.ativo && <span className="shrink-0 text-xs text-muted-foreground">inativo</span>}

      {podeEditar && (
        <span className="flex shrink-0 gap-1">
          <button
            type="button" onClick={aoEditar} aria-label={`Editar ${item.nome}`}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button" onClick={alternar} disabled={pendente}
            aria-label={item.ativo ? `Desativar ${item.nome}` : `Reativar ${item.nome}`}
            title={item.ativo ? 'Desativar' : 'Reativar'}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            {item.ativo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </span>
      )}
    </li>
  )
}

export function ListaCadastros({
  tipo, itens, podeEditar,
}: {
  tipo: TipoCadastro
  itens: ItemListado[]
  podeEditar: boolean
}) {
  const config = CONFIG_TIPO[tipo]
  const [formulario, setFormulario] = useState<null | { item: ItemListado | null }>(null)
  const [busca, setBusca] = useState('')

  const termo = busca.trim().toLowerCase()
  const visiveis = termo
    ? itens.filter((i) =>
        [i.codigo, i.nome, i.detalhe, i.identificador, i.local, i.observacao]
          .some((v) => v?.toLowerCase().includes(termo)),
      )
    : itens

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar em ${config.rotuloPlural.toLowerCase()}`}
            aria-label={`Buscar em ${config.rotuloPlural.toLowerCase()}`}
            className={`${CAMPO} pl-8`}
          />
        </div>
        {podeEditar && !formulario && (
          <button
            type="button" onClick={() => setFormulario({ item: null })} data-testid="novo-cadastro"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Adicionar
          </button>
        )}
      </div>

      {formulario && (
        <Formulario tipo={tipo} item={formulario.item} aoFechar={() => setFormulario(null)} />
      )}

      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {itens.length === 0
            ? `Nenhum${config.rotuloSingular === 'Material' || config.rotuloSingular === 'Veículo' ? '' : 'a'} ${config.rotuloSingular.toLowerCase()} cadastrad${config.rotuloSingular === 'Material' || config.rotuloSingular === 'Veículo' ? 'o' : 'a'} ainda.`
            : 'Nada encontrado com esse termo.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="lista-cadastros">
          {visiveis.map((item) => (
            <Linha
              key={item.id} item={item} tipo={tipo} podeEditar={podeEditar}
              aoEditar={() => setFormulario({ item })}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
