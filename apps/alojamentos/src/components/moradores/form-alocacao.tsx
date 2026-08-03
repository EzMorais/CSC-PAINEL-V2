'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Search, UserRound, TriangleAlert } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { criarAlocacao } from '@/actions/alocacoes'
import { ROTULO_NIVEL_OBRA, ROTULO_TIPO_TRANSPORTE, TIPO_TRANSPORTE } from '@/lib/dominio/constantes'
import type { FuncionarioRh } from '@/lib/cliente-rh'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Opcoes = {
  alojamentos: Array<{ id: string; nome: string; quartos: Array<{ id: string; numero: string; capacidade: number }> }>
  rotas: Array<{ id: string; nome: string }>
}

export function FormAlocacao({
  funcionarios, jaAlocados, opcoes, erroRh, hoje,
}: {
  funcionarios: FuncionarioRh[]
  jaAlocados: string[]
  opcoes: Opcoes
  erroRh: string | null
  hoje: string
}) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<FuncionarioRh | null>(null)
  const [alojamentoId, setAlojamentoId] = useState('')
  const [transporte, setTransporte] = useState<string>(TIPO_TRANSPORTE.PROPRIO)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const alocados = useMemo(() => new Set(jaAlocados), [jaAlocados])

  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return funcionarios
      .filter((f) => !alocados.has(f.id))
      .filter((f) =>
        !termo ||
        f.nome.toLowerCase().includes(termo) ||
        f.matricula.toLowerCase().includes(termo) ||
        (f.cargo ?? '').toLowerCase().includes(termo),
      )
      .slice(0, 40)
  }, [funcionarios, alocados, busca])

  const quartos = opcoes.alojamentos.find((a) => a.id === alojamentoId)?.quartos ?? []

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!escolhido) return setErro('Escolha quem vai morar.')
    const fd = new FormData(e.currentTarget)
    setErro(null)

    iniciar(async () => {
      const r = await chamarAction(criarAlocacao({
        ...Object.fromEntries(fd.entries()),
        funcionarioId: escolhido.id,
        funcionarioNome: escolhido.nome,
        funcionarioMatricula: escolhido.matricula,
        obraCodigo: escolhido.obraCodigo ?? '',
      }))
      if (!r.ok) return setErro(r.erro)
      router.push('/moradores')
      router.refresh()
    })
  }

  if (erroRh) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <TriangleAlert className="size-4" /> Não deu para buscar as pessoas no RH
        </p>
        <p className="text-sm text-muted-foreground">{erroRh}</p>
        <p className="text-sm text-muted-foreground">
          A lista de quem pode morar vem do cadastro do RH. Assim que ele estiver no ar, esta
          tela volta a funcionar sozinha.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-5 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <span className="mb-1 block text-sm font-medium">Quem vai morar *</span>
        {escolhido ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-background">
              {escolhido.foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI vinda do RH
                <img src={escolhido.foto} alt="" className="size-full object-cover" />
              ) : (
                <UserRound className="size-5 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{escolhido.nome}</p>
              <p className="text-xs text-muted-foreground">
                <span className="tabular">{escolhido.matricula}</span>
                {escolhido.cargo && <> · {escolhido.cargo}</>}
                {escolhido.nivelObra && <> · {ROTULO_NIVEL_OBRA[escolhido.nivelObra] ?? escolhido.nivelObra}</>}
                {escolhido.obraCodigo && <> · Obra {escolhido.obraCodigo}</>}
              </p>
            </div>
            <button type="button" onClick={() => setEscolhido(null)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
              trocar
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca} onChange={(e) => setBusca(e.target.value)} data-testid="buscar-funcionario"
                placeholder="Procurar por nome, matrícula ou cargo…" className={`${CAMPO} pl-9`}
              />
            </div>
            <ul className="mt-2 max-h-64 divide-y divide-border/50 overflow-y-auto rounded-md border border-border" data-testid="lista-funcionarios">
              {disponiveis.length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  {funcionarios.length === 0
                    ? 'Nenhum funcionário ativo no RH.'
                    : 'Ninguém encontrado — ou todos já estão alocados.'}
                </li>
              ) : (
                disponiveis.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button" onClick={() => setEscolhido(f)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                    >
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted">
                        {f.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element -- data URI vinda do RH
                          <img src={f.foto} alt="" className="size-full object-cover" />
                        ) : (
                          <UserRound className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{f.nome}</span>
                        <span className="block text-xs text-muted-foreground">
                          <span className="tabular">{f.matricula}</span>
                          {f.cargo && <> · {f.cargo}</>}
                          {f.nivelObra && <> · {ROTULO_NIVEL_OBRA[f.nivelObra] ?? f.nivelObra}</>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="alojamentoId" className="mb-1 block text-sm font-medium">Alojamento *</label>
          <select
            id="alojamentoId" name="alojamentoId" required value={alojamentoId}
            onChange={(e) => setAlojamentoId(e.target.value)} className={CAMPO}
          >
            <option value="">— escolha —</option>
            {opcoes.alojamentos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="quartoId" className="mb-1 block text-sm font-medium">Quarto</label>
          <select id="quartoId" name="quartoId" defaultValue="" className={CAMPO} disabled={!alojamentoId}>
            <option value="">— sem quarto definido —</option>
            {quartos.map((q) => <option key={q.id} value={q.id}>Quarto {q.numero} ({q.capacidade} lugares)</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="dataEntrada" className="mb-1 block text-sm font-medium">Entrada *</label>
          <input id="dataEntrada" name="dataEntrada" type="date" required defaultValue={hoje} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="transporteTipo" className="mb-1 block text-sm font-medium">Como vai para a obra</label>
          <select
            id="transporteTipo" name="transporteTipo" value={transporte}
            onChange={(e) => setTransporte(e.target.value)} className={CAMPO}
          >
            {Object.values(TIPO_TRANSPORTE).map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_TRANSPORTE[t]}</option>
            ))}
          </select>
        </div>

        {transporte === TIPO_TRANSPORTE.CARONA && (
          <div className="sm:col-span-2">
            <label htmlFor="caronaComNome" className="mb-1 block text-sm font-medium">Carona com quem</label>
            <input id="caronaComNome" name="caronaComNome" placeholder="Nome de quem dá a carona" className={CAMPO} />
          </div>
        )}

        {transporte === TIPO_TRANSPORTE.ONIBUS && (
          <div className="sm:col-span-2">
            <label htmlFor="rotaOnibusId" className="mb-1 block text-sm font-medium">Rota do ônibus</label>
            <select id="rotaOnibusId" name="rotaOnibusId" defaultValue="" className={CAMPO}>
              <option value="">— escolha a rota —</option>
              {opcoes.rotas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
            {opcoes.rotas.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Nenhuma rota cadastrada ainda — dá para cadastrar em Ônibus.</p>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="observacoes" className="mb-1 block text-sm font-medium">Observações</label>
          <textarea id="observacoes" name="observacoes" rows={2} className={CAMPO} />
        </div>
      </div>

      {erro && <p role="alert" data-testid="erro-form" className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="submit" disabled={pendente || !escolhido} data-testid="salvar-alocacao"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Alocando…' : 'Alocar morador'}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
