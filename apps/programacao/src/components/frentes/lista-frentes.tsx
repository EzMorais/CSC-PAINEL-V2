'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { criarFrente, editarFrente, alternarFrente, apagarFrente, moverFrente } from '@/actions/frentes'
import { CORES_FRENTE } from '@/lib/dominio/constantes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type FrenteItem = {
  id: string
  nome: string
  cor: string
  colunas: number
  obraCodigo: string | null
  ativa: boolean
  usos: number
}

type Rascunho = { nome: string; cor: string; colunas: number; obraCodigo: string }

const VAZIO: Rascunho = { nome: '', cor: CORES_FRENTE[0].valor, colunas: 1, obraCodigo: '' }

export function ListaFrentes({ frentes, podeEditar }: { frentes: FrenteItem[]; podeEditar: boolean }) {
  const router = useRouter()
  const [editando, setEditando] = useState<null | { id: string | null; dados: Rascunho }>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function agir(promessa: Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }>, aoFim?: () => void) {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(promessa)
      if (!r.ok) return setErro(r.erro)
      aoFim?.()
      router.refresh()
    })
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    const entrada = { ...editando.dados, obraCodigo: editando.dados.obraCodigo || null }
    agir(
      editando.id ? editarFrente(editando.id, entrada) : criarFrente(entrada),
      () => setEditando(null),
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {frentes.filter((f) => f.ativa).length} ativas de {frentes.length}
        </p>
        {podeEditar && !editando && (
          <button
            type="button" onClick={() => setEditando({ id: null, dados: VAZIO })}
            data-testid="nova-frente"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Novo cliente
          </button>
        )}
      </div>

      {editando && (
        <form onSubmit={salvar} className="space-y-3 rounded-lg border border-primary/40 bg-card p-4">
          <p className="text-sm font-semibold">
            {editando.id ? 'Editar frente' : 'Novo cliente / frente'}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="nome" className="mb-1 block text-sm font-medium">Nome *</label>
              <input
                id="nome" value={editando.dados.nome} required autoFocus
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, nome: e.target.value } })}
                placeholder="TOYOTA, MORELLI, GALPÃO…" className={CAMPO}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                É o que aparece no cabeçalho da coluna, na imagem enviada ao grupo.
              </p>
            </div>

            <div>
              <label htmlFor="obraCodigo" className="mb-1 block text-sm font-medium">Código da obra no RH</label>
              <input
                id="obraCodigo" value={editando.dados.obraCodigo}
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, obraCodigo: e.target.value } })}
                placeholder="opcional" className={CAMPO}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Só informativo, para ligar a frente à obra correspondente no RH.
              </p>
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium">Cor do cabeçalho</span>
              <div className="flex flex-wrap gap-1.5">
                {CORES_FRENTE.map((c) => (
                  <button
                    key={c.valor} type="button" title={c.nome} aria-label={c.nome}
                    onClick={() => setEditando({ ...editando, dados: { ...editando.dados, cor: c.valor } })}
                    className={`size-8 rounded border-2 transition-transform ${
                      editando.dados.cor === c.valor ? 'border-foreground scale-110' : 'border-border'
                    }`}
                    style={{ backgroundColor: c.valor }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="colunas" className="mb-1 block text-sm font-medium">Colunas na imagem</label>
              <select
                id="colunas" value={editando.dados.colunas}
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, colunas: Number(e.target.value) } })}
                className={CAMPO}
              >
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Teto, não obrigação: a frente só abre a segunda coluna quando passa de 25
                pessoas. Deixe 2 para as grandes, como MORELLI.
              </p>
            </div>
          </div>

          {erro && <p role="alert" data-testid="erro-frente" className="text-sm text-destructive">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-frente"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button" onClick={() => { setEditando(null); setErro(null) }}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!editando && erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="lista-frentes">
        {frentes.map((f, i) => (
          <li key={f.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${f.ativa ? '' : 'opacity-55'}`}>
            <span
              aria-hidden className="size-6 shrink-0 rounded border border-border"
              style={{ backgroundColor: f.cor }}
            />

            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{f.nome}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {f.colunas > 1 && `até ${f.colunas} colunas · `}
                {f.obraCodigo && `obra ${f.obraCodigo} · `}
                {f.usos > 0 ? `${f.usos} lançamentos` : 'nunca usada'}
                {!f.ativa && ' · inativa'}
              </span>
            </span>

            {podeEditar && (
              <span className="flex shrink-0 gap-1">
                <button
                  type="button" aria-label={`Subir ${f.nome}`} disabled={i === 0 || pendente}
                  onClick={() => agir(moverFrente(f.id, 'cima'))}
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button" aria-label={`Descer ${f.nome}`} disabled={i === frentes.length - 1 || pendente}
                  onClick={() => agir(moverFrente(f.id, 'baixo'))}
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" />
                </button>
                <button
                  type="button" aria-label={`Editar ${f.nome}`}
                  onClick={() => setEditando({
                    id: f.id,
                    dados: { nome: f.nome, cor: f.cor, colunas: f.colunas, obraCodigo: f.obraCodigo ?? '' },
                  })}
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button" aria-label={f.ativa ? `Desativar ${f.nome}` : `Reativar ${f.nome}`}
                  title={f.ativa ? 'Desativar' : 'Reativar'} disabled={pendente}
                  onClick={() => agir(alternarFrente(f.id, !f.ativa))}
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
                >
                  {f.ativa ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                {f.usos === 0 && (
                  <button
                    type="button" aria-label={`Apagar ${f.nome}`} title="Apagar" disabled={pendente}
                    onClick={() => agir(apagarFrente(f.id))}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Frente que já apareceu em algum dia não pode ser apagada, só desativada — apagar
        levaria junto a programação dos dias em que ela aparece, e o histórico deixaria de
        dizer quem estava onde. Desativada, ela some do quadro de amanhã e continua nos dias
        antigos.
      </p>
    </div>
  )
}
