'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Search, UserRound } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import {
  criarFuncionario, editarFuncionario, alternarAtivoFuncionario, alternarAusencia, apagarFuncionario,
} from '@/actions/funcionarios'
import { criarFuncao, editarCorFuncao } from '@/actions/funcoes'
import { fotoParaDataUri } from '@/lib/imagem-cliente'
import { CORES_FUNCAO, corTextoPara } from '@/lib/dominio/constantes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type FuncaoOpcao = { sigla: string; nome: string; cor: string }
export type FuncionarioItem = {
  id: string
  nome: string
  funcaoSigla: string | null
  foto: string | null
  ativo: boolean
  ausente: boolean
  ausenteObs: string | null
  motorista: boolean
  tipo: string
  usos: number
}

type Rascunho = { nome: string; funcaoSigla: string; foto: string; motorista: boolean; tipo: string }

const VAZIO: Rascunho = { nome: '', funcaoSigla: '', foto: '', motorista: false, tipo: 'CSC' }

/** O crachá redondo: foto se tiver, senão a sigla da função colorida pelo grupo dela. */
function Cracha({ foto, sigla, cor }: { foto: string | null; sigla: string | null; cor: string }) {
  if (foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URI local, sem servidor de imagem
      <img src={foto} alt="" className="size-10 shrink-0 rounded-full object-cover" />
    )
  }
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-full text-[11px] font-bold"
      style={{ backgroundColor: sigla ? cor : '#9CA3AF', color: sigla ? corTextoPara(cor) : '#1F2937' }}
    >
      {sigla ? sigla.slice(0, 5) : <UserRound className="size-4" />}
    </span>
  )
}

export function ListaFuncionarios({
  funcionarios, funcoes: funcoesIniciais, podeEditar,
}: {
  funcionarios: FuncionarioItem[]
  funcoes: FuncaoOpcao[]
  podeEditar: boolean
}) {
  const router = useRouter()
  const [funcoes, setFuncoes] = useState(funcoesIniciais)
  const [editando, setEditando] = useState<null | { id: string | null; dados: Rascunho }>(null)
  const [criandoFuncao, setCriandoFuncao] = useState(false)
  const [novaSigla, setNovaSigla] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState(CORES_FUNCAO[0].valor)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [erroFoto, setErroFoto] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const funcaoPorSigla = useMemo(() => new Map(funcoes.map((f) => [f.sigla, f])), [funcoes])
  const funcaoSelecionada = editando ? funcaoPorSigla.get(editando.dados.funcaoSigla) : undefined

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return funcionarios
    return funcionarios.filter(
      (f) => f.nome.toLowerCase().includes(termo) || (f.funcaoSigla ?? '').toLowerCase().includes(termo),
    )
  }, [funcionarios, busca])

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
    const entrada = { ...editando.dados, funcaoSigla: editando.dados.funcaoSigla || null, foto: editando.dados.foto || null }
    agir(
      editando.id ? editarFuncionario(editando.id, entrada) : criarFuncionario(entrada),
      () => setEditando(null),
    )
  }

  function adicionarFuncao() {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(criarFuncao({ sigla: novaSigla, nome: novoNome, cor: novaCor }))
      if (!r.ok) return setErro(r.erro)
      setFuncoes((atuais) => [...atuais, r.dados])
      if (editando) setEditando({ ...editando, dados: { ...editando.dados, funcaoSigla: r.dados.sigla } })
      setCriandoFuncao(false)
      setNovaSigla('')
      setNovoNome('')
      setNovaCor(CORES_FUNCAO[0].valor)
    })
  }

  function mudarCorDaFuncao(cor: string) {
    if (!funcaoSelecionada) return
    setFuncoes((atuais) => atuais.map((f) => (f.sigla === funcaoSelecionada.sigla ? { ...f, cor } : f)))
    agir(editarCorFuncao(funcaoSelecionada.sigla, cor))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou sigla" aria-label="Buscar funcionário"
            className={`${CAMPO} pl-8`}
          />
        </div>
        {podeEditar && !editando && (
          <button
            type="button" onClick={() => setEditando({ id: null, dados: VAZIO })}
            data-testid="novo-funcionario"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Novo funcionário
          </button>
        )}
      </div>

      {editando && (
        <form onSubmit={salvar} className="space-y-3 rounded-lg border border-primary/40 bg-card p-4">
          <p className="text-sm font-semibold">{editando.id ? 'Editar funcionário' : 'Novo funcionário'}</p>

          <div className="flex items-center gap-4">
            <Cracha foto={editando.dados.foto || null} sigla={editando.dados.funcaoSigla || null} cor={funcaoSelecionada?.cor ?? CORES_FUNCAO[0].valor} />
            <div className="min-w-0 space-y-1.5">
              <input
                type="file" accept="image/*" data-testid="foto-funcionario"
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
              <label htmlFor="nome" className="mb-1 block text-sm font-medium">Nome *</label>
              <input
                id="nome" value={editando.dados.nome} required autoFocus
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, nome: e.target.value } })}
                className={CAMPO}
              />
            </div>

            <div>
              <label htmlFor="tipo" className="mb-1 block text-sm font-medium">Tipo</label>
              <select
                id="tipo" value={editando.dados.tipo}
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, tipo: e.target.value } })}
                className={CAMPO}
              >
                <option value="CSC">CSC</option>
                <option value="PRESTADOR">Prestador</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="funcaoSigla" className="mb-1 block text-sm font-medium">Função</label>
              <div className="flex gap-2">
                <select
                  id="funcaoSigla" value={editando.dados.funcaoSigla}
                  onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, funcaoSigla: e.target.value } })}
                  className={CAMPO}
                >
                  <option value="">— sem função —</option>
                  {funcoes.map((f) => <option key={f.sigla} value={f.sigla}>{f.sigla} — {f.nome}</option>)}
                </select>
                <button
                  type="button" onClick={() => setCriandoFuncao((v) => !v)}
                  title="Nova função" aria-label="Nova função"
                  className="grid size-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {funcaoSelecionada && !criandoFuncao && (
                <div className="mt-2">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    Cor de {funcaoSelecionada.sigla} — muda em todo mundo que tem essa função
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CORES_FUNCAO.map((c) => (
                      <button
                        key={c.valor} type="button" title={c.nome} aria-label={`Cor ${c.nome} para ${funcaoSelecionada.sigla}`}
                        onClick={() => mudarCorDaFuncao(c.valor)}
                        className={`size-7 rounded border-2 transition-transform ${
                          funcaoSelecionada.cor === c.valor ? 'border-foreground scale-110' : 'border-border'
                        }`}
                        style={{ backgroundColor: c.valor }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {criandoFuncao && (
                <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      data-testid="nova-funcao-sigla"
                      value={novaSigla} onChange={(e) => setNovaSigla(e.target.value.toUpperCase())}
                      placeholder="Sigla (ex: PD)" autoFocus className={CAMPO}
                    />
                    <input
                      data-testid="nova-funcao-nome"
                      value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
                      placeholder="Nome da função" className={CAMPO}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs text-muted-foreground">Cor do grupo</span>
                    <div className="flex flex-wrap gap-1.5">
                      {CORES_FUNCAO.map((c) => (
                        <button
                          key={c.valor} type="button" title={c.nome} aria-label={c.nome}
                          onClick={() => setNovaCor(c.valor)}
                          className={`size-7 rounded border-2 transition-transform ${
                            novaCor === c.valor ? 'border-foreground scale-110' : 'border-border'
                          }`}
                          style={{ backgroundColor: c.valor }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button" data-testid="criar-funcao"
                      onClick={adicionarFuncao} disabled={pendente || !novaSigla.trim() || !novoNome.trim()}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Criar função
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCriandoFuncao(false); setNovaSigla(''); setNovoNome('') }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox" checked={editando.dados.motorista}
                onChange={(e) => setEditando({ ...editando, dados: { ...editando.dados, motorista: e.target.checked } })}
              />
              É motorista
            </label>
          </div>

          {erro && <p role="alert" data-testid="erro-funcionario" className="text-sm text-destructive">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-funcionario"
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

      <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="lista-funcionarios">
        {filtrados.map((f) => {
          const funcao = f.funcaoSigla ? funcaoPorSigla.get(f.funcaoSigla) : undefined
          return (
            <li key={f.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${f.ativo ? '' : 'opacity-55'}`}>
              <Cracha foto={f.foto} sigla={f.funcaoSigla} cor={funcao?.cor ?? CORES_FUNCAO[0].valor} />

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.nome}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {funcao ? `${funcao.sigla} — ${funcao.nome}` : 'sem função'}
                  {f.motorista && ' · motorista'}
                  {f.tipo === 'PRESTADOR' && ' · prestador'}
                  {f.usos > 0 ? ` · ${f.usos} lançamentos` : ' · nunca escalado'}
                  {!f.ativo && ' · inativo'}
                  {f.ausente && ` · ausente${f.ausenteObs ? ` (${f.ausenteObs})` : ''}`}
                </span>
              </span>

              {podeEditar && (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button" aria-label={f.ausente ? `Marcar ${f.nome} como presente` : `Marcar ${f.nome} como ausente`}
                    title={f.ausente ? 'Marcar presente' : 'Marcar ausente'} disabled={pendente}
                    onClick={() => agir(alternarAusencia(f.id, !f.ausente))}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      f.ausente ? 'border-status-atencao/50 bg-status-atencao/10 text-status-atencao' : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {f.ausente ? 'Ausente' : 'Presente'}
                  </button>
                  <button
                    type="button" aria-label={`Editar ${f.nome}`}
                    onClick={() => setEditando({
                      id: f.id,
                      dados: {
                        nome: f.nome, funcaoSigla: f.funcaoSigla ?? '', foto: f.foto ?? '',
                        motorista: f.motorista, tipo: f.tipo,
                      },
                    })}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button" aria-label={f.ativo ? `Desativar ${f.nome}` : `Reativar ${f.nome}`}
                    title={f.ativo ? 'Desativar' : 'Reativar'} disabled={pendente}
                    onClick={() => agir(alternarAtivoFuncionario(f.id, !f.ativo))}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40"
                  >
                    {f.ativo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  {f.usos === 0 && (
                    <button
                      type="button" aria-label={`Apagar ${f.nome}`} title="Apagar" disabled={pendente}
                      onClick={() => agir(apagarFuncionario(f.id))}
                      className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </span>
              )}
            </li>
          )
        })}
        {filtrados.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum funcionário encontrado.</li>
        )}
      </ul>
    </div>
  )
}
