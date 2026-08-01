'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { registrarEvento } from '@/actions/funcionarios'
import { EVENTO, ROTULO_EVENTO, type TipoEvento } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

export type ItemTimeline = {
  id: string
  tipo: string
  descricaoHumana: string
  detalhe: string | null
  ocorridoEm: Date
  registradoPor: string | null
}

/**
 * Só os tipos que fazem sentido registrar à mão.
 *
 * Admissão, mudança de obra, de cargo e desligamento são gerados pelo próprio sistema
 * quando o cadastro muda — oferecê-los aqui deixaria a timeline aceitar um "mudou de
 * obra" que não corresponde a mudança nenhuma no cadastro.
 */
const TIPOS_MANUAIS: TipoEvento[] = [
  EVENTO.ADVERTENCIA,
  EVENTO.PROMOCAO,
  EVENTO.OBSERVACAO,
  EVENTO.FERIAS,
  EVENTO.AFASTAMENTO,
  EVENTO.RETORNO,
]

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function Timeline({ funcionarioId, itens }: { funcionarioId: string; itens: ItemTimeline[] }) {
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function registrar(fd: FormData) {
    setErro(null)
    iniciar(async () => {
      const r = await registrarEvento(funcionarioId, Object.fromEntries(fd.entries()))
      if (!r.ok) return setErro(r.erro)
      setCriando(false)
    })
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Linha do tempo</h2>
        {!criando && (
          <button
            type="button"
            onClick={() => setCriando(true)}
            data-testid="novo-evento"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
          >
            <Plus className="size-4" /> Registrar
          </button>
        )}
      </div>

      {criando && (
        <form action={registrar} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tipo" className="mb-1 block text-sm font-medium">Tipo *</label>
              <select id="tipo" name="tipo" required defaultValue={EVENTO.OBSERVACAO} className={CAMPO}>
                {TIPOS_MANUAIS.map((t) => (
                  <option key={t} value={t}>{ROTULO_EVENTO[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ocorridoEm" className="mb-1 block text-sm font-medium">Quando aconteceu *</label>
              <input id="ocorridoEm" name="ocorridoEm" type="date" required defaultValue={hoje} className={CAMPO} />
            </div>
          </div>

          <div>
            <label htmlFor="descricaoHumana" className="mb-1 block text-sm font-medium">Descrição *</label>
            <input id="descricaoHumana" name="descricaoHumana" required className={CAMPO} />
          </div>

          <div>
            <label htmlFor="detalhe" className="mb-1 block text-sm font-medium">Detalhe</label>
            <textarea id="detalhe" name="detalhe" rows={3} className={CAMPO} />
          </div>

          {erro && (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {erro}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente} data-testid="salvar-evento"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Registrando…' : 'Registrar'}
            </button>
            <button
              type="button" onClick={() => { setCriando(false); setErro(null) }}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
      ) : (
        <ol data-testid="timeline" className="relative space-y-4 border-l border-border pl-5">
          {itens.map((e) => (
            <li key={e.id} className="relative">
              {/* O ponto na linha: -left alinha o centro do círculo sobre a borda. */}
              <span
                aria-hidden
                className="absolute -left-[1.4375rem] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary"
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium">
                  {ROTULO_EVENTO[e.tipo as TipoEvento] ?? e.tipo}
                </p>
                <span className="text-xs tabular text-muted-foreground">{dataBR(e.ocorridoEm)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{e.descricaoHumana}</p>
              {e.detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{e.detalhe}</p>}
              {e.registradoPor && (
                <p className="mt-0.5 text-xs text-muted-foreground/70">por {e.registradoPor}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
