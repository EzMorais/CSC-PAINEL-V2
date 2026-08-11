'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { criarFrente, editarFrente, alternarFrente, apagarFrente, moverFrente } from '@/actions/frentes'
import { CORES_FRENTE } from '@/lib/dominio/constantes'
import { logoParaDataUri } from '@/lib/imagem-cliente'
import { PaletaCores } from '@/components/ui/paleta-cores'
import { LogoCliente } from '@/components/frentes/logo-cliente'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type FrenteItem = {
  id: string
  nome: string
  cor: string
  logo: string | null
  colunas: number
  obraCodigo: string | null
  ativa: boolean
  usos: number
}

type Rascunho = { nome: string; cor: string; logo: string; colunas: number; obraCodigo: string }

const VAZIO: Rascunho = { nome: '', cor: CORES_FRENTE[0].valor, logo: '', colunas: 1, obraCodigo: '' }

export function ListaFrentes({ frentes, podeEditar }: { frentes: FrenteItem[]; podeEditar: boolean }) {
  const router = useRouter()
  const [editando, setEditando] = useState<null | { id: string | null; dados: Rascunho }>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroLogo, setErroLogo] = useState<string | null>(null)
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

  function escolherLogo(arquivo: File | null) {
    if (!arquivo || !editando) return
    setErroLogo(null)
    logoParaDataUri(arquivo)
      .then((logo) => setEditando({ ...editando, dados: { ...editando.dados, logo } }))
      .catch((e) => setErroLogo(e instanceof Error ? e.message : 'Não foi possível ler a logo.'))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {frentes.filter((f) => f.ativa).length} ativas de {frentes.length}
        </p>
        {podeEditar && !editando && (
          <button
            type="button" onClick={() => { setErro(null); setErroLogo(null); setEditando({ id: null, dados: VAZIO }) }}
            data-testid="nova-frente"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Novo cliente
          </button>
        )}
      </div>

      {editando && (
        <form onSubmit={salvar} className="space-y-5 rounded-2xl border border-primary/25 bg-card p-5 shadow-sm">
          <div>
            <p className="text-base font-semibold">
            {editando.id ? 'Editar frente' : 'Novo cliente / frente'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Identidade visual e organização da coluna.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="mb-2 block text-sm font-medium">Logo do cliente</span>
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/25 p-4">
                <div className="grid size-20 place-items-center rounded-xl bg-background shadow-sm">
                  <LogoCliente src={editando.dados.logo || null} nome={editando.dados.nome || 'Cliente'} cor={editando.dados.cor} grande />
                </div>
                <div className="min-w-56 flex-1 space-y-2">
                  <input
                    id="logo-cliente" type="file"
                    accept="image/png,image/jpeg,image/gif,image/bmp,image/webp,image/svg+xml,image/tiff,image/avif,image/x-icon"
                    onChange={(e) => escolherLogo(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
                  />
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF, BMP, WEBP, SVG, TIFF e outros formatos de imagem. A proporção será preservada.</p>
                  {editando.dados.logo && (
                    <button
                      type="button"
                      onClick={() => { setEditando({ ...editando, dados: { ...editando.dados, logo: '' } }); setErroLogo(null) }}
                      className="text-xs font-medium text-muted-foreground hover:text-destructive"
                    >
                      Remover logo
                    </button>
                  )}
                  {erroLogo && <p role="alert" className="text-xs text-destructive">{erroLogo}</p>}
                </div>
              </div>
            </div>

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
              <PaletaCores
                cores={CORES_FRENTE}
                valor={editando.dados.cor}
                onChange={(cor) => setEditando({ ...editando, dados: { ...editando.dados, cor } })}
                rotulo="Cores do cabeçalho da frente"
              />
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
              type="button" onClick={() => { setEditando(null); setErro(null); setErroLogo(null) }}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!editando && erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      <ul className="grid gap-3 md:grid-cols-2" data-testid="lista-frentes">
        {frentes.map((f, i) => (
          <li key={f.id} className={`relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${f.ativa ? '' : 'opacity-55'}`}>
            <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: f.cor }} />
            <div className="flex items-start gap-3">
              <LogoCliente src={f.logo} nome={f.nome} cor={f.cor} grande />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{f.nome}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${f.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                    {f.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                {f.colunas > 1 && `até ${f.colunas} colunas · `}
                {f.obraCodigo && `obra ${f.obraCodigo} · `}
                {f.usos > 0 ? `${f.usos} lançamentos` : 'nunca usada'}
                </span>
              </span>
            </div>

            {podeEditar && (
              <span className="mt-4 flex justify-end gap-1 border-t border-border/60 pt-3">
                <button
                  type="button" aria-label={`Subir ${f.nome}`} disabled={i === 0 || pendente}
                  onClick={() => agir(moverFrente(f.id, 'cima'))}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button" aria-label={`Descer ${f.nome}`} disabled={i === frentes.length - 1 || pendente}
                  onClick={() => agir(moverFrente(f.id, 'baixo'))}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" />
                </button>
                <button
                  type="button" aria-label={`Editar ${f.nome}`}
                  onClick={() => {
                    setErro(null)
                    setErroLogo(null)
                    setEditando({
                      id: f.id,
                      dados: { nome: f.nome, cor: f.cor, logo: f.logo ?? '', colunas: f.colunas, obraCodigo: f.obraCodigo ?? '' },
                    })
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button" aria-label={f.ativa ? `Desativar ${f.nome}` : `Reativar ${f.nome}`}
                  title={f.ativa ? 'Desativar' : 'Reativar'} disabled={pendente}
                  onClick={() => agir(alternarFrente(f.id, !f.ativa))}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  {f.ativa ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                {f.usos === 0 && (
                  <button
                    type="button" aria-label={`Apagar ${f.nome}`} title="Apagar" disabled={pendente}
                    onClick={() => agir(apagarFrente(f.id))}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            )}
            </li>
        ))}
      </ul>

      <p className="rounded-2xl bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        Frente que já apareceu em algum dia não pode ser apagada, só desativada — apagar
        levaria junto a programação dos dias em que ela aparece, e o histórico deixaria de
        dizer quem estava onde. Desativada, ela some do quadro de amanhã e continua nos dias
        antigos.
      </p>
    </div>
  )
}
