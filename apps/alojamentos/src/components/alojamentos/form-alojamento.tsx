'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { House, X } from 'lucide-react'
import { chamarAction } from '@/lib/chamar-action'
import { criarAlojamento, editarAlojamento } from '@/actions/alojamentos'
import { fotoParaDataUri } from '@/lib/imagem-cliente'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type ValoresAlojamento = Partial<Record<string, string>>

export function FormAlojamento({
  id, valores = {}, mapaLigado,
}: {
  id: string | null
  valores?: ValoresAlojamento
  mapaLigado: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [foto, setFoto] = useState(valores.foto ?? '')
  const [erroFoto, setErroFoto] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function escolherFoto(arquivo: File | null) {
    if (!arquivo) return
    setErroFoto(null)
    fotoParaDataUri(arquivo, 800)
      .then(setFoto)
      .catch((e) => setErroFoto(e instanceof Error ? e.message : 'Não foi possível ler a imagem.'))
  }

  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const dados = { ...Object.fromEntries(fd.entries()), foto }
    setErro(null)

    iniciar(async () => {
      if (id) {
        const r = await chamarAction(editarAlojamento(id, dados))
        if (!r.ok) return setErro(r.erro)
        router.push(`/alojamentos/${id}`)
      } else {
        const r = await chamarAction(criarAlojamento(dados))
        if (!r.ok) return setErro(r.erro)
        router.push(`/alojamentos/${r.dados.id}`)
      }
      router.refresh()
    })
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <span className="mb-1 block text-sm font-medium">Foto do alojamento</span>
        <div className="flex items-center gap-4">
          <span className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI do banco; next/image não serve para base64 local
              <img src={foto} alt="Foto do alojamento" className="size-full object-cover" />
            ) : (
              <House className="size-8 text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0 space-y-2">
            <input
              type="file" accept="image/*" data-testid="foto-alojamento"
              onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border
                         file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
            />
            {foto && (
              <button
                type="button" onClick={() => setFoto('')}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" /> Remover
              </button>
            )}
            {erroFoto && <p role="alert" className="text-xs text-destructive">{erroFoto}</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="nome" className="mb-1 block text-sm font-medium">Nome do alojamento *</label>
          <input id="nome" name="nome" required defaultValue={valores.nome ?? ''} placeholder="Ex.: Alojamento Central" className={CAMPO} />
        </div>

        <div>
          <label htmlFor="cep" className="mb-1 block text-sm font-medium">CEP</label>
          <input id="cep" name="cep" defaultValue={valores.cep ?? ''} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="logradouro" className="mb-1 block text-sm font-medium">Logradouro</label>
          <input id="logradouro" name="logradouro" defaultValue={valores.logradouro ?? ''} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="numero" className="mb-1 block text-sm font-medium">Número</label>
          <input id="numero" name="numero" defaultValue={valores.numero ?? ''} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="complemento" className="mb-1 block text-sm font-medium">Complemento</label>
          <input id="complemento" name="complemento" defaultValue={valores.complemento ?? ''} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="bairro" className="mb-1 block text-sm font-medium">Bairro</label>
          <input id="bairro" name="bairro" defaultValue={valores.bairro ?? ''} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="cidade" className="mb-1 block text-sm font-medium">Cidade</label>
          <input id="cidade" name="cidade" defaultValue={valores.cidade ?? ''} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="uf" className="mb-1 block text-sm font-medium">UF</label>
          <input id="uf" name="uf" maxLength={2} defaultValue={valores.uf ?? ''} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="capacidadeTotal" className="mb-1 block text-sm font-medium">Capacidade total</label>
          <input
            id="capacidadeTotal" name="capacidadeTotal" type="number" min={0}
            defaultValue={valores.capacidadeTotal ?? ''} className={CAMPO}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Se você cadastrar os quartos, a soma deles é que vale.
          </p>
        </div>

        <div>
          <label htmlFor="responsavelNome" className="mb-1 block text-sm font-medium">Responsável</label>
          <input id="responsavelNome" name="responsavelNome" defaultValue={valores.responsavelNome ?? ''} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="telefoneResponsavel" className="mb-1 block text-sm font-medium">Telefone do responsável</label>
          <input
            id="telefoneResponsavel" name="telefoneResponsavel" defaultValue={valores.telefoneResponsavel ?? ''}
            placeholder="(11) 90000-0000" className={CAMPO}
          />
          <p className="mt-1 text-xs text-muted-foreground">Com DDD — é por ele que o WhatsApp abre.</p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="observacoes" className="mb-1 block text-sm font-medium">Observações</label>
          <textarea id="observacoes" name="observacoes" rows={3} defaultValue={valores.observacoes ?? ''} className={CAMPO} />
        </div>
      </div>

      {!mapaLigado && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          O mapa ainda não está ligado. O endereço é salvo normalmente; assim que a chave do
          Google Maps for cadastrada, o ponto no mapa e a distância até a obra passam a aparecer.
        </p>
      )}

      {erro && <p role="alert" data-testid="erro-form" className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="submit" disabled={pendente} data-testid="salvar-alojamento"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar alojamento'}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
