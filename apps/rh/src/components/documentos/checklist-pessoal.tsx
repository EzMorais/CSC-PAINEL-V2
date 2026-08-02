'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Paperclip } from 'lucide-react'
import { registrarDocumentoPessoal } from '@/actions/documentos'
import { CATEGORIA_DOCUMENTO_PESSOAL, ROTULO_CATEGORIA_DOCUMENTO_PESSOAL, type CategoriaDocumentoPessoal } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import type { FuncionarioParaDocumento } from '@/queries/documentos'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

type DocPessoal = { id: string; arquivo: string | null; criadoEm: string; versao: number }

function lerComoDataUri(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(arquivo)
  })
}

function ItemChecklist({
  funcionarioId, categoria, doc,
}: {
  funcionarioId: string
  categoria: CategoriaDocumentoPessoal
  doc: DocPessoal | undefined
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setErro(null)
    iniciar(async () => {
      const dataUri = await lerComoDataUri(arquivo)
      const r = await registrarDocumentoPessoal({ funcionarioId, categoria, arquivo: dataUri })
      if (!r.ok) setErro(r.erro)
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2 last:border-0">
      <div>
        <p className="text-sm">{ROTULO_CATEGORIA_DOCUMENTO_PESSOAL[categoria]}</p>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>
      {doc ? (
        <a
          href={doc.arquivo ?? '#'} download={`${categoria}-v${doc.versao}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Check className="size-3.5" /> Enviado em {dataBR(new Date(doc.criadoEm))}
        </a>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Paperclip className="size-3.5" />
          {pendente ? 'Enviando…' : 'Anexar'}
          <input type="file" accept="application/pdf,image/*" className="hidden" disabled={pendente} onChange={aoEscolherArquivo} />
        </label>
      )}
    </li>
  )
}

export function ChecklistPessoal({
  funcionarios, funcionarioId, documentosPorCategoria,
}: {
  funcionarios: FuncionarioParaDocumento[]
  funcionarioId: string
  documentosPorCategoria: Record<string, DocPessoal>
}) {
  const router = useRouter()
  const categorias = Object.values(CATEGORIA_DOCUMENTO_PESSOAL)
  const enviados = categorias.filter((c) => documentosPorCategoria[c]).length

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Checklist de admissão por funcionário</h2>
        <select
          value={funcionarioId}
          onChange={(e) => router.push(`/documentos?funcionarioId=${e.target.value}`)}
          className={`${CAMPO} w-auto`}
        >
          <option value="">— selecione um funcionário —</option>
          {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome} — {f.matricula}</option>)}
        </select>
      </div>

      {!funcionarioId ? (
        <p className="text-sm text-muted-foreground">Escolha um funcionário para ver o checklist dele.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{enviados} de {categorias.length} documentos enviados</p>
          <ul>
            {categorias.map((c) => (
              <ItemChecklist key={c} funcionarioId={funcionarioId} categoria={c} doc={documentosPorCategoria[c]} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
