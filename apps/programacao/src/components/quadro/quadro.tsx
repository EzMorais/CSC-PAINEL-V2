'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Plus, X, GripVertical, Truck, TriangleAlert, Search, UserPlus } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { escalar, moverEscala, tirarEscala, trocarFuncao, adicionarRecurso, tirarRecurso } from '@/actions/programacao'
import { TIPO_RECURSO } from '@/lib/dominio/constantes'
import type { Conflito } from '@/lib/dominio/conflitos'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type FrenteQuadro = { id: string; nome: string; cor: string }
export type EscalaQuadro = {
  id: string; frenteId: string; nome: string; funcaoSigla: string | null; funcionarioId: string | null
}
export type RecursoQuadro = {
  id: string; frenteId: string; tipo: string; descricao: string
  motoristaNome: string | null; destaque: boolean; placa: string | null
}
export type PessoaDisponivel = { id: string; nome: string; cargo: string | null; obraCodigo: string | null }
export type VeiculoDisponivel = { placa: string; nome: string; motorista: string | null; emManutencao: boolean }
export type MaquinaDisponivel = { id: string; nome: string; codigo: string }

/**
 * O quadro do dia.
 *
 * Arrastar usa o mecanismo do próprio navegador, sem biblioteca: são cartões de texto numa
 * lista, e um pacote de arrastar-e-soltar traria trezentos kilobytes e um jeito próprio de
 * fazer as coisas para resolver o que `draggable` já resolve.
 *
 * Como arrastar não funciona em tela de toque, todo cartão também move por clique: seleciona
 * a pessoa e clica na frente de destino. Não é acessório — quem monta a programação às vezes
 * ajusta pelo celular no caminho de casa.
 */
export function Quadro({
  data, frentes, escalas, recursos, disponiveis, veiculos, maquinas, funcoes, conflitos, podeEditar,
}: {
  data: string
  frentes: FrenteQuadro[]
  escalas: EscalaQuadro[]
  recursos: RecursoQuadro[]
  disponiveis: PessoaDisponivel[]
  veiculos: VeiculoDisponivel[]
  maquinas: MaquinaDisponivel[]
  funcoes: Array<{ sigla: string; nome: string; cargoRh: string | null }>
  conflitos: Conflito[]
  podeEditar: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [, iniciar] = useTransition()

  const jaEscalados = useMemo(
    () => new Set(escalas.map((e) => e.nome.trim().toLowerCase())),
    [escalas],
  )

  const siglaDoCargo = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of funcoes) if (f.cargoRh) m.set(f.cargoRh.toLowerCase(), f.sigla)
    return m
  }, [funcoes])

  const naoEscalados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return disponiveis
      .filter((p) => !jaEscalados.has(p.nome.trim().toLowerCase()))
      .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || (p.cargo ?? '').toLowerCase().includes(termo))
  }, [disponiveis, jaEscalados, busca])

  function agir(promessa: Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(promessa)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  function soltarNaFrente(frenteId: string, escalaId: string | null, pessoa: PessoaDisponivel | null) {
    if (!podeEditar) return
    if (escalaId) return agir(moverEscala(escalaId, frenteId))
    if (pessoa) {
      return agir(escalar({
        data, frenteId, nome: pessoa.nome, funcionarioId: pessoa.id,
        funcaoSigla: pessoa.cargo ? siglaDoCargo.get(pessoa.cargo.toLowerCase()) ?? null : null,
      }))
    }
  }

  return (
    <div className="space-y-4">
      {conflitos.length > 0 && <PainelConflitos conflitos={conflitos} />}
      {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{erro}</p>}

      <div className="flex gap-3 overflow-x-auto pb-3">
        {/* Coluna de quem ainda não foi escalado */}
        <section className="flex w-64 shrink-0 flex-col rounded-lg border border-border bg-card">
          <header className="rounded-t-lg border-b border-border bg-muted/50 px-3 py-2">
            <h2 className="text-sm font-semibold">Sem frente</h2>
            <p className="text-xs text-muted-foreground">{naoEscalados.length} pessoas</p>
          </header>

          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pessoa" aria-label="Buscar pessoa"
                className={`${CAMPO} pl-7`}
              />
            </div>
          </div>

          <div className="max-h-[28rem] space-y-1 overflow-y-auto p-2">
            {naoEscalados.length === 0 && (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                {disponiveis.length === 0
                  ? 'O RH não respondeu ou não tem ninguém cadastrado. Use "avulso" nas frentes.'
                  : 'Todo mundo já está escalado.'}
              </p>
            )}
            {naoEscalados.map((p) => (
              <button
                key={p.id} type="button" draggable={podeEditar}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ pessoaId: p.id }))}
                onClick={() => setSelecionada(selecionada === `p:${p.id}` ? null : `p:${p.id}`)}
                data-testid={`disponivel-${p.id}`}
                className={`flex w-full items-center gap-1.5 rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                  selecionada === `p:${p.id}`
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <GripVertical className="size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.nome}</span>
                  {p.cargo && <span className="block truncate text-muted-foreground">{p.cargo}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>

        {frentes.map((f) => (
          <ColunaFrente
            key={f.id}
            data={data}
            frente={f}
            escalas={escalas.filter((e) => e.frenteId === f.id)}
            recursos={recursos.filter((r) => r.frenteId === f.id)}
            veiculos={veiculos}
            maquinas={maquinas}
            funcoes={funcoes}
            podeEditar={podeEditar}
            temConflito={conflitos.some((c) => c.frenteIds.includes(f.id))}
            selecionada={selecionada}
            aoSelecionar={setSelecionada}
            aoSoltar={(escalaId, pessoaId) =>
              soltarNaFrente(f.id, escalaId, pessoaId ? disponiveis.find((p) => p.id === pessoaId) ?? null : null)
            }
            agir={agir}
          />
        ))}
      </div>
    </div>
  )
}

function ColunaFrente({
  data, frente, escalas, recursos, veiculos, maquinas, funcoes,
  podeEditar, temConflito, selecionada, aoSelecionar, aoSoltar, agir,
}: {
  data: string
  frente: FrenteQuadro
  escalas: EscalaQuadro[]
  recursos: RecursoQuadro[]
  veiculos: VeiculoDisponivel[]
  maquinas: MaquinaDisponivel[]
  funcoes: Array<{ sigla: string; nome: string; cargoRh: string | null }>
  podeEditar: boolean
  temConflito: boolean
  selecionada: string | null
  aoSelecionar: (v: string | null) => void
  aoSoltar: (escalaId: string | null, pessoaId: string | null) => void
  agir: (p: Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }>) => void
}) {
  const [sobre, setSobre] = useState(false)
  const [abrindoAvulso, setAbrindoAvulso] = useState(false)
  const [abrindoRecurso, setAbrindoRecurso] = useState(false)

  function receber(e: React.DragEvent) {
    e.preventDefault()
    setSobre(false)
    try {
      const carga = JSON.parse(e.dataTransfer.getData('text/plain')) as
        { escalaId?: string; pessoaId?: string }
      aoSoltar(carga.escalaId ?? null, carga.pessoaId ?? null)
    } catch {
      // Arrasto de fora da tela (arquivo, texto): ignorar em silêncio.
    }
  }

  /** Clique na coluna move o que estiver selecionado — o caminho de quem usa no celular. */
  function clicarNaColuna() {
    if (!selecionada) return
    const [tipo, id] = selecionada.split(':')
    aoSoltar(tipo === 'e' ? id : null, tipo === 'p' ? id : null)
    aoSelecionar(null)
  }

  return (
    <section
      onDragOver={(e) => { if (podeEditar) { e.preventDefault(); setSobre(true) } }}
      onDragLeave={() => setSobre(false)}
      onDrop={receber}
      onClick={clicarNaColuna}
      data-testid={`frente-${frente.id}`}
      className={`flex w-64 shrink-0 flex-col rounded-lg border bg-card transition-colors ${
        sobre ? 'border-primary ring-2 ring-primary/30'
        : temConflito ? 'border-destructive/50' : 'border-border'
      } ${selecionada ? 'cursor-copy' : ''}`}
    >
      <header
        className="flex items-center gap-2 rounded-t-lg border-b border-border px-3 py-2"
        style={{ backgroundColor: frente.cor }}
      >
        <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-black">{frente.nome}</h2>
        {temConflito && <TriangleAlert className="size-4 shrink-0 text-red-800" />}
        <span className="shrink-0 rounded-full bg-black/15 px-1.5 text-xs font-medium text-black tabular">
          {escalas.length}
        </span>
      </header>

      <div className="max-h-[28rem] flex-1 space-y-1 overflow-y-auto p-2">
        {escalas.map((e, i) => (
          <div
            key={e.id} draggable={podeEditar}
            onDragStart={(ev) => {
              ev.stopPropagation()
              ev.dataTransfer.setData('text/plain', JSON.stringify({ escalaId: e.id }))
            }}
            data-testid={`escala-${e.id}`}
            className="group flex items-center gap-1 rounded border border-border px-1.5 py-1 text-xs hover:bg-accent"
          >
            <span className="w-4 shrink-0 text-right text-[10px] font-bold text-muted-foreground tabular">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate" title={e.nome}>{e.nome}</span>

            {podeEditar ? (
              <select
                value={e.funcaoSigla ?? ''}
                onClick={(ev) => ev.stopPropagation()}
                onChange={(ev) => { ev.stopPropagation(); agir(trocarFuncao(e.id, ev.target.value)) }}
                aria-label={`Função de ${e.nome}`}
                className="w-16 shrink-0 rounded border border-input bg-background px-0.5 text-[10px]"
              >
                <option value="">—</option>
                {funcoes.map((f) => <option key={f.sigla} value={f.sigla}>{f.sigla}</option>)}
              </select>
            ) : (
              e.funcaoSigla && <span className="shrink-0 text-[10px] text-muted-foreground">{e.funcaoSigla}</span>
            )}

            {podeEditar && (
              <button
                type="button" aria-label={`Tirar ${e.nome}`}
                onClick={(ev) => { ev.stopPropagation(); agir(tirarEscala(e.id)) }}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}

        {escalas.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {podeEditar ? 'Arraste alguém para cá' : 'Ninguém escalado'}
          </p>
        )}
      </div>

      {/* Veículos, máquinas e avisos no pé — como no print */}
      <div className="space-y-1 border-t border-border p-2">
        {recursos.map((r) => (
          <div
            key={r.id}
            className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium ${
              r.destaque ? 'bg-yellow-300 text-black'
              : r.tipo === TIPO_RECURSO.AVISO ? 'border border-border'
              : 'bg-orange-200 text-black'
            }`}
          >
            <Truck className="size-3 shrink-0 opacity-60" />
            <span className="min-w-0 flex-1 truncate">
              {r.descricao}{r.motoristaNome ? ` - ${r.motoristaNome}` : ''}
            </span>
            {podeEditar && (
              <button
                type="button" aria-label={`Tirar ${r.descricao}`}
                onClick={(ev) => { ev.stopPropagation(); agir(tirarRecurso(r.id)) }}
                className="shrink-0 rounded p-0.5 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}

        {podeEditar && (
          <div className="flex gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button" onClick={() => setAbrindoAvulso((v) => !v)}
              data-testid={`avulso-${frente.id}`}
              className="flex flex-1 items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-[11px] text-muted-foreground hover:bg-accent"
            >
              <UserPlus className="size-3" /> Avulso
            </button>
            <button
              type="button" onClick={() => setAbrindoRecurso((v) => !v)}
              data-testid={`recurso-${frente.id}`}
              className="flex flex-1 items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-[11px] text-muted-foreground hover:bg-accent"
            >
              <Plus className="size-3" /> Veículo
            </button>
          </div>
        )}

        {abrindoAvulso && (
          <FormAvulso
            data={data} frenteId={frente.id} funcoes={funcoes}
            aoFechar={() => setAbrindoAvulso(false)} agir={agir}
          />
        )}
        {abrindoRecurso && (
          <FormRecurso
            data={data} frenteId={frente.id} veiculos={veiculos} maquinas={maquinas}
            aoFechar={() => setAbrindoRecurso(false)} agir={agir}
          />
        )}
      </div>
    </section>
  )
}

function FormAvulso({
  data, frenteId, funcoes, aoFechar, agir,
}: {
  data: string; frenteId: string
  funcoes: Array<{ sigla: string; nome: string }>
  aoFechar: () => void
  agir: (p: Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }>) => void
}) {
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')

  return (
    <form
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault()
        if (nome.trim().length < 2) return
        agir(escalar({ data, frenteId, nome, funcaoSigla: sigla || null }))
        setNome('')
        aoFechar()
      }}
      className="space-y-1 rounded border border-border bg-muted/30 p-1.5"
    >
      <input
        value={nome} onChange={(e) => setNome(e.target.value)} autoFocus
        placeholder="Nome de quem não está no RH" aria-label="Nome"
        className={`${CAMPO} text-xs`}
      />
      <div className="flex gap-1">
        <select value={sigla} onChange={(e) => setSigla(e.target.value)} aria-label="Função" className={`${CAMPO} text-xs`}>
          <option value="">função…</option>
          {funcoes.map((f) => <option key={f.sigla} value={f.sigla}>{f.sigla} — {f.nome}</option>)}
        </select>
        <button type="submit" className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
          Add
        </button>
      </div>
    </form>
  )
}

function FormRecurso({
  data, frenteId, veiculos, maquinas, aoFechar, agir,
}: {
  data: string; frenteId: string
  veiculos: VeiculoDisponivel[]
  maquinas: MaquinaDisponivel[]
  aoFechar: () => void
  agir: (p: Promise<{ ok: true; dados: unknown } | { ok: false; erro: string }>) => void
}) {
  const [escolha, setEscolha] = useState('')
  const [motorista, setMotorista] = useState('')

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!escolha) return

    const [tipo, chave] = escolha.split('::')
    if (tipo === 'v') {
      const v = veiculos.find((x) => x.placa === chave)
      if (!v) return
      agir(adicionarRecurso({
        data, frenteId, tipo: TIPO_RECURSO.VEICULO,
        descricao: `${v.nome} ${v.placa}`.trim(), placa: v.placa,
        motoristaNome: motorista || v.motorista || null,
      }))
    } else if (tipo === 'm') {
      const m = maquinas.find((x) => x.id === chave)
      if (!m) return
      agir(adicionarRecurso({
        data, frenteId, tipo: TIPO_RECURSO.MAQUINA, descricao: m.nome, motoristaNome: motorista || null,
      }))
    } else {
      agir(adicionarRecurso({
        data, frenteId, tipo: TIPO_RECURSO.AVISO, descricao: chave, destaque: true,
      }))
    }
    aoFechar()
  }

  return (
    <form onClick={(e) => e.stopPropagation()} onSubmit={enviar} className="space-y-1 rounded border border-border bg-muted/30 p-1.5">
      <select
        value={escolha} onChange={(e) => setEscolha(e.target.value)} autoFocus
        aria-label="Veículo ou máquina" className={`${CAMPO} text-xs`}
      >
        <option value="">escolha…</option>
        {veiculos.length > 0 && (
          <optgroup label="Veículos">
            {veiculos.map((v) => (
              <option key={v.placa} value={`v::${v.placa}`}>
                {v.nome} {v.placa}{v.emManutencao ? ' ⚠ oficina' : ''}
              </option>
            ))}
          </optgroup>
        )}
        {maquinas.length > 0 && (
          <optgroup label="Máquinas">
            {maquinas.map((m) => <option key={m.id} value={`m::${m.id}`}>{m.nome}</option>)}
          </optgroup>
        )}
        <optgroup label="Aviso">
          <option value="a::MANUTENÇÃO">MANUTENÇÃO</option>
          <option value="a::FOLGA">FOLGA</option>
          <option value="a::TREINAMENTO">TREINAMENTO</option>
        </optgroup>
      </select>
      <div className="flex gap-1">
        <input
          value={motorista} onChange={(e) => setMotorista(e.target.value)}
          placeholder="Motorista (opcional)" aria-label="Motorista" className={`${CAMPO} text-xs`}
        />
        <button type="submit" className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
          Add
        </button>
      </div>
    </form>
  )
}

function PainelConflitos({ conflitos }: { conflitos: Conflito[] }) {
  const [aberto, setAberto] = useState(false)
  const graves = conflitos.filter((c) => c.gravidade === 'alta').length

  return (
    <section className={`rounded-lg border p-3 ${graves > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-status-atencao/50 bg-status-atencao/5'}`}>
      <button
        type="button" onClick={() => setAberto((v) => !v)} data-testid="conflitos"
        className="flex w-full items-center gap-2 text-left text-sm font-medium"
      >
        <TriangleAlert className={`size-4 shrink-0 ${graves > 0 ? 'text-destructive' : 'text-status-atencao'}`} />
        <span className="flex-1">
          {conflitos.length} {conflitos.length === 1 ? 'aviso' : 'avisos'} no quadro
          {graves > 0 && ` · ${graves} ${graves === 1 ? 'grave' : 'graves'}`}
        </span>
        <span className="text-xs text-muted-foreground">{aberto ? 'esconder' : 'ver'}</span>
      </button>

      {aberto && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {conflitos.map((c, i) => (
            <li key={i} className="flex items-start gap-2 border-t border-border/50 pt-1.5 first:border-0 first:pt-0">
              <span className={`mt-1 size-1.5 shrink-0 rounded-full ${c.gravidade === 'alta' ? 'bg-destructive' : 'bg-status-atencao'}`} />
              <span>
                <span className="font-medium">{c.titulo}</span>
                <span className="block text-xs text-muted-foreground">{c.detalhe}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
