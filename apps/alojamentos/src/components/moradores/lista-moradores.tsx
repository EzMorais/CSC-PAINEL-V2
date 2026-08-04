'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { DoorOpen, MessageCircle, MessageCircleOff } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { encerrarAlocacao, atualizarTelefone } from '@/actions/alocacoes'
import { SeloStatusAlocacao, SeloTransporte } from '@/components/selo'
import { STATUS_ALOCACAO } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import type { AlocacaoListada } from '@/queries/moradores'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Linha({ a, hoje }: { a: AlocacaoListada; hoje: string }) {
  const router = useRouter()
  const [encerrando, setEncerrando] = useState(false)
  const [editandoZap, setEditandoZap] = useState(false)
  const [telefone, setTelefone] = useState(a.telefone ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const ativa = a.status === STATUS_ALOCACAO.ATIVA

  function salvarTelefone() {
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(atualizarTelefone(a.id, telefone))
      if (!r.ok) return setErro(r.erro)
      setEditandoZap(false)
      router.refresh()
    })
  }

  function aoEncerrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await chamarAction(encerrarAlocacao(a.id, Object.fromEntries(fd.entries())))
      if (!r.ok) return setErro(r.erro)
      setEncerrando(false)
      router.refresh()
    })
  }

  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium">{a.funcionarioNome}</p>
          <p className="text-xs text-muted-foreground">
            <span className="tabular">{a.funcionarioMatricula}</span>
            {' · '}{a.alojamento.nome}
            {a.quarto && <> · Quarto {a.quarto.numero}</>}
            {a.obraCodigo && <> · Obra {a.obraCodigo}</>}
          </p>
          <p className="text-xs text-muted-foreground">
            Entrou em {dataBR(a.dataEntrada)}
            {a.dataSaida && <> · saiu em {dataBR(a.dataSaida)}</>}
            {a.motivoSaida && <> ({a.motivoSaida})</>}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SeloTransporte tipo={a.transporteTipo} />
          {a.rotaOnibus && <span className="text-xs text-muted-foreground">{a.rotaOnibus.nome}</span>}
          {a.caronaComNome && <span className="text-xs text-muted-foreground">com {a.caronaComNome}</span>}
          <SeloStatusAlocacao status={a.status} />
          {ativa && !editandoZap && (
            <button
              type="button" onClick={() => setEditandoZap(true)} data-testid={`whatsapp-${a.id}`}
              title={a.telefone ? `WhatsApp: ${a.telefone}` : 'Sem WhatsApp cadastrado — a pessoa não consegue abrir pedido por lá'}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-accent ${
                a.telefone ? 'border-border text-muted-foreground' : 'border-dashed border-border text-muted-foreground/70'
              }`}
            >
              {a.telefone
                ? <><MessageCircle className="size-3.5" /> {a.telefone}</>
                : <><MessageCircleOff className="size-3.5" /> sem WhatsApp</>}
            </button>
          )}
          {ativa && !encerrando && (
            <button
              type="button" onClick={() => setEncerrando(true)} data-testid={`encerrar-${a.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
            >
              <DoorOpen className="size-3.5" /> Registrar saída
            </button>
          )}
        </div>
      </div>

      {editandoZap && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <label htmlFor={`tel-${a.id}`} className="block text-xs font-medium">
            WhatsApp de {a.funcionarioNome.split(' ')[0]}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`tel-${a.id}`} type="tel" inputMode="tel" value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(62) 99999-1234" className={`${CAMPO} max-w-xs`}
            />
            <button
              type="button" onClick={salvarTelefone} disabled={pendente}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => { setEditandoZap(false); setTelefone(a.telefone ?? ''); setErro(null) }}
              className="rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            É por este número que a pessoa abre pedido pelo WhatsApp e recebe aviso quando ele
            andar. Deixe em branco para remover.
          </p>
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
        </div>
      )}

      {encerrando && (
        <form onSubmit={aoEncerrar} className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="dataSaida" type="date" required defaultValue={hoje} className={CAMPO} />
            <input name="motivoSaida" placeholder="Motivo (opcional)" className={CAMPO} />
          </div>
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={pendente}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pendente ? 'Registrando…' : 'Confirmar saída'}
            </button>
            <button type="button" onClick={() => { setEncerrando(false); setErro(null) }} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {erro && !encerrando && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    </li>
  )
}

export function ListaMoradores({ alocacoes, hoje }: { alocacoes: AlocacaoListada[]; hoje: string }) {
  if (alocacoes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Ninguém alocado ainda.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm shadow-sm" data-testid="lista-moradores">
      {alocacoes.map((a) => <Linha key={a.id} a={a} hoje={hoje} />)}
    </ul>
  )
}
