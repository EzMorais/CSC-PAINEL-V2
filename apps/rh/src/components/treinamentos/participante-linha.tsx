'use client'

import { useRef, useState, useTransition } from 'react'
import { Paperclip, Check, X } from 'lucide-react'
import { anexarCertificado, removerParticipante } from '@/actions/treinamentos'

export type Participante = {
  id: string
  certificado: string | null
  funcionario: { id: string; nome: string; matricula: string }
}

/** Lê o arquivo escolhido como data URI — mesmo raciocínio da assinatura: sem armazenamento de arquivo neste app, só texto no SQLite. */
function lerComoDataUri(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(arquivo)
  })
}

export function ParticipanteLinha({ participante }: { participante: Participante }) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [removendo, iniciarRemocao] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setErro(null)
    iniciar(async () => {
      const dataUri = await lerComoDataUri(arquivo)
      const r = await anexarCertificado({ participanteId: participante.id, certificado: dataUri })
      if (!r.ok) setErro(r.erro)
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function remover() {
    setErro(null)
    iniciarRemocao(async () => {
      const r = await removerParticipante(participante.id)
      if (!r.ok) setErro(r.erro)
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2 last:border-0">
      <div>
        <p className="text-sm font-medium">{participante.funcionario.nome}</p>
        <p className="text-xs tabular text-muted-foreground">{participante.funcionario.matricula}</p>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>

      {participante.certificado ? (
        <a
          href={participante.certificado}
          download={`certificado-${participante.funcionario.matricula}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Check className="size-3.5" /> Certificado anexado
        </a>
      ) : (
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Paperclip className="size-3.5" />
            {pendente ? 'Enviando…' : 'Anexar certificado'}
            <input
              ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden"
              disabled={pendente} onChange={aoEscolherArquivo}
            />
          </label>
          <button
            type="button" onClick={remover} disabled={removendo}
            title="Remover participante" aria-label="Remover participante"
            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </li>
  )
}
