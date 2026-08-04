'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Copy, Download, CircleCheck } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { copiarDe, publicar } from '@/actions/programacao'

/**
 * A barra de ações do dia: copiar de outro dia, baixar a imagem, publicar.
 *
 * "Copiar" é o botão que justifica o módulo. Hoje o quadro inteiro é redigitado toda tarde,
 * e quase todo mundo continua na mesma frente — copiando, só se mexe em quem mudou.
 */
export function BarraDoDia({
  data, temConteudo, anteriorIso, anteriorTitulo, publicada, podeEditar,
}: {
  data: string
  temConteudo: boolean
  anteriorIso: string | null
  anteriorTitulo: string | null
  publicada: boolean
  podeEditar: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, iniciar] = useTransition()

  function copiar() {
    if (!anteriorIso) return
    setErro(null)
    setAviso(null)
    setConfirmando(false)
    iniciar(async () => {
      const r = await chamarAction(copiarDe({ data, origem: anteriorIso }))
      if (!r.ok) return setErro(r.erro)
      setAviso(`Copiado: ${r.dados.escalas} pessoas e ${r.dados.recursos} veículos.`)
      router.refresh()
    })
  }

  function aoPublicar() {
    setErro(null)
    setAviso(null)
    iniciar(async () => {
      const r = await chamarAction(publicar({ data }))
      if (!r.ok) return setErro(r.erro)
      setAviso('Marcada como publicada.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {podeEditar && anteriorIso && (
          // Copiar por cima de um quadro já começado apagaria o trabalho de quem montou —
          // por isso a confirmação só aparece quando há o que perder.
          confirmando ? (
            <span className="flex flex-wrap items-center gap-2 rounded-md border border-status-atencao/50 bg-status-atencao/10 px-3 py-1.5 text-xs">
              Isso apaga o que já está neste dia. Copiar mesmo assim?
              <button
                type="button" onClick={copiar} disabled={pendente}
                className="rounded bg-primary px-2 py-1 font-medium text-primary-foreground disabled:opacity-50"
              >
                Copiar
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className="rounded border border-border px-2 py-1">
                Cancelar
              </button>
            </span>
          ) : (
            <button
              type="button" disabled={pendente}
              onClick={() => (temConteudo ? setConfirmando(true) : copiar())}
              data-testid="copiar-dia"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Copy className="size-4" />
              {pendente ? 'Copiando…' : `Copiar de ${anteriorTitulo ?? 'ontem'}`}
            </button>
          )
        )}

        {temConteudo && (
          <a
            href={`/api/imagem/${data}`} download={`programacao-${data}.png`}
            data-testid="baixar-imagem"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Download className="size-4" /> Baixar imagem
          </a>
        )}

        {podeEditar && temConteudo && !publicada && (
          <button
            type="button" onClick={aoPublicar} disabled={pendente}
            data-testid="publicar"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <CircleCheck className="size-4" /> Marcar como publicada
          </button>
        )}

        {publicada && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-ativa/15 px-2.5 py-1 text-xs font-medium text-status-ativa">
            <CircleCheck className="size-3.5" /> Publicada
          </span>
        )}
      </div>

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
    </div>
  )
}
