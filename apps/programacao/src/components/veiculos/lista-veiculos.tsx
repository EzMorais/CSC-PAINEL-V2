'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Search, Truck } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { criarVeiculo, editarVeiculo, alternarAtivoVeiculo, apagarVeiculo } from '@/actions/veiculos'
import { fotoParaDataUri } from '@/lib/imagem-cliente'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type VeiculoItem = {
  id: string
  modelo: string
  placa: string | null
  motoristaNome: string | null
  foto: string | null
  ativo: boolean
  usos: number
}

type Rascunho = { modelo: string; placa: string; motoristaNome: string; foto: string }

const VAZIO: Rascunho = { modelo: '', placa: '', motoristaNome: '', foto: '' }

export function ListaVeiculos({ veiculos, podeEditar }: { veiculos: VeiculoItem[]; podeEditar: boolean }) {
  const router = useRouter()
  const [editando, setEditando] = useState<null | { id: string | null; dados: Rascunho }>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroFoto, setErroFoto] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [pendente, iniciar] = useTransition()

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return veiculos
    return veiculos.filter(
      (v) => v.modelo.toLowerCase().includes(termo) || (v.placa ?? '').toLowerCase().includes(termo),
    )
  }, [veiculos, busca])

  function agir(promessa: Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }>, aoFim?: () => void) {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(promessa)
      if (!r.ok) return setErro(r.erro)
      aoFim?.()
      router.refresh()
    })
  }

  function escolherFoto(arquivo: File | null) {
    if (!arquivo || !editando) return
    setErroFoto(null)
    fotoParaDataUri(arquivo)
      .then((foto) => setEditando({ ...editando, dados: { ...editando.dados, foto } }))
      .catch((e) => setErroFoto(e instanceof Error ? e.message : 'Não foi possível ler a imagem.'))
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    const entrada = {
      ...editando.dados,
      placa: editando.dados.placa || null,
      motoristaNome: editando.dados.motoristaNome || null,
      foto: editando.dados.foto || null,
    }
    agir(
      editando.id ? editarVeiculo(editando.id, entrada) : criarVeiculo(entrada),
      () => setEditando(null),
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por modelo ou placa" aria-label="Buscar veículo"
            className={`${CAMPO} pl-8`}
          />
        </div>
        {podeEditar && !editando && (
          <button
            type="button" onClick={() => setEditando({ id: null, dados: VAZIO })}
            data-testid="novo-veiculo"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Novo veículo
          </button>
        )}
      </div>

      {editando && (
        <form onSubmit={salvar} className="space-y-3 rounded-lg border border-primary/40 bg-card p-4">
          <p className="text-sm font-semibold">{editando.id ? 'Editar veículo' : 'Novo veículo'}</p>

          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
              {editando.dados.foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI local, sem servidor de imagem
                <img src={editando.dados.foto} alt="" className="size-full object-cover" />
              ) : (
                <Truck className="size-6 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 space-y-1.5">
              <input
                type="file" accept="image/*" data-testid="foto-veiculo"
                onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border
                           file:border-border file:bg-background file:px-2.5 file:py-1 file:text-xs"
              />
              {editando.dados.foto && (
                <button
                  type="button" onClick={() => setEditando({ ...editando, dados: { ...editando.dados, foto: '' } })}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" /> Remover foto
                </button>
              )}
              {erroFoto && <p role="alert" className="text-xs text-destructive">{erroFoto}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modelo" className="mb-1 block text-sm font-medium">Modelo *</label>
              <input
                id="modelo" value={editando.dados.modelo} required autoFocus
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, modelo: e.target.value } })}
                placeholder="DOBLO ATTRACTIV 1.4 - BRANCA" className={CAMPO}
              />
            </div>
            <div>
              <label htmlFor="placa" className="mb-1 block text-sm font-medium">Placa</label>
              <input
                id="placa" value={editando.dados.placa}
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, placa: e.target.value.toUpperCase() } })}
                placeholder="opcional" className={CAMPO}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="motoristaNome" className="mb-1 block text-sm font-medium">Motorista fixo</label>
              <input
                id="motoristaNome" value={editando.dados.motoristaNome}
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, motoristaNome: e.target.value } })}
                placeholder="opcional" className={CAMPO}
              />
            </div>
          </div>

          {erro && <p role="alert" data-testid="erro-veiculo" className="text-sm text-destructive">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-veiculo"
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

      <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="lista-veiculos">
        {filtrados.map((v) => (
          <li key={v.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${v.ativo ? '' : 'opacity-55'}`}>
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
              {v.foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI local, sem servidor de imagem
                <img src={v.foto} alt="" className="size-full object-cover" />
              ) : (
                <Truck className="size-4 text-muted-foreground" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{v.modelo}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {v.placa && `${v.placa} · `}
                {v.motoristaNome ? `motorista fixo: ${v.motoristaNome}` : 'sem motorista fixo'}
                {v.usos > 0 ? ` · ${v.usos} lançamentos` : ' · nunca usado'}
                {!v.ativo && ' · inativo'}
              </span>
            </span>

            {podeEditar && (
              <span className="flex shrink-0 gap-1">
                <button
                  type="button" aria-label={`Editar ${v.modelo}`}
                  onClick={() => setEditando({
                    id: v.id,
                    dados: {
                      modelo: v.modelo, placa: v.placa ?? '',
                      motoristaNome: v.motoristaNome ?? '', foto: v.foto ?? '',
                    },
                  })}
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button" aria-label={v.ativo ? `Desativar ${v.modelo}` : `Reativar ${v.modelo}`}
                  title={v.ativo ? 'Desativar' : 'Reativar'} disabled={pendente}
                  onClick={() => agir(alternarAtivoVeiculo(v.id, !v.ativo))}
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
                >
                  {v.ativo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                {v.usos === 0 && (
                  <button
                    type="button" aria-label={`Apagar ${v.modelo}`} title="Apagar" disabled={pendente}
                    onClick={() => agir(apagarVeiculo(v.id))}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum veículo encontrado.</li>
        )}
      </ul>
    </div>
  )
}
