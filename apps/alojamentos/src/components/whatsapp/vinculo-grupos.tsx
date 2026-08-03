'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Users, Link2, Link2Off, Check } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { vincularGrupo } from '@/actions/grupos-whatsapp'
import type { GrupoWhatsapp } from '@/lib/cliente-whatsapp'

type AlojamentoSimples = { id: string; nome: string; grupoWhatsappId: string | null }

/**
 * Liga cada grupo de WhatsApp ao alojamento dele.
 *
 * A lista vem do próprio WhatsApp, e não é digitada: o identificador de um grupo não
 * aparece em lugar nenhum do aplicativo, então pedir para alguém digitá-lo seria pedir o
 * impossível.
 */
export function VinculoGrupos({
  grupos, alojamentos,
}: {
  grupos: GrupoWhatsapp[]
  alojamentos: AlojamentoSimples[]
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [, iniciar] = useTransition()

  const alojamentoDoGrupo = new Map(
    alojamentos.filter((a) => a.grupoWhatsappId).map((a) => [a.grupoWhatsappId!, a]),
  )

  function escolher(grupoId: string, alojamentoId: string) {
    setErro(null)
    setSalvando(grupoId)
    iniciar(async () => {
      // Escolher "nenhum" desfaz o vínculo do alojamento que tinha este grupo.
      const alvo = alojamentoId || alojamentoDoGrupo.get(grupoId)?.id
      if (!alvo) return setSalvando(null)

      const r = await chamarAction(vincularGrupo(alvo, alojamentoId ? grupoId : ''))
      setSalvando(null)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  if (grupos.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        O número não está em nenhum grupo. Adicione o celular corporativo aos grupos dos
        alojamentos e recarregue esta página.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {grupos.map((g) => {
        const vinculado = alojamentoDoGrupo.get(g.id)
        return (
          <div
            key={g.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3 ${
              vinculado ? 'border-status-ativa/40 bg-status-ativa/5' : 'border-border'
            }`}
          >
            {vinculado
              ? <Link2 className="size-4 shrink-0 text-status-ativa" />
              : <Link2Off className="size-4 shrink-0 text-muted-foreground" />}

            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{g.nome}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3" /> {g.participantes} participantes
              </span>
            </span>

            <select
              value={vinculado?.id ?? ''}
              onChange={(e) => escolher(g.id, e.target.value)}
              disabled={salvando === g.id}
              aria-label={`Alojamento do grupo ${g.nome}`}
              data-testid={`vinculo-${g.id}`}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm
                         outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">— não é de alojamento —</option>
              {alojamentos.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>

            {salvando === g.id && <span className="text-xs text-muted-foreground">salvando…</span>}
            {vinculado && salvando !== g.id && <Check className="size-4 shrink-0 text-status-ativa" />}
          </div>
        )
      })}

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  )
}
