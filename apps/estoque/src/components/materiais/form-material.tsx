'use client'

import { chamarAction } from '@/lib/chamar-action'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { criarMaterial, editarMaterial } from '@/actions/materiais'
import { CATEGORIA_MATERIAL, ROTULO_CATEGORIA_MATERIAL, UNIDADE } from '@/lib/dominio/constantes'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type ValoresMaterial = Partial<Record<string, string>>

type Props = {
  /** null = cadastro novo. */
  id: string | null
  codigo: string
  valores?: ValoresMaterial
}

export function FormMaterial({ id, codigo, valores = {} }: Props) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  // Controlada: os campos de CA só existem quando o material é EPI.
  const [categoria, setCategoria] = useState(valores.categoria ?? CATEGORIA_MATERIAL.OUTRO)
  const ehEpi = categoria === CATEGORIA_MATERIAL.EPI

  // onSubmit + preventDefault, não `action={fn}`: o form action do React 19 reseta os
  // campos assim que a função retorna, inclusive quando ela falha na validação — o que
  // apagaria tudo que foi digitado bem na hora de corrigir o erro.
  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    const dados = Object.fromEntries(fd.entries())

    iniciar(async () => {
      // Os dois ramos são tratados separados porque só a criação devolve um id.
      if (id) {
        const r = await chamarAction(editarMaterial(id, dados))
        if (!r.ok) return setErro(r.erro)
        router.push(`/materiais/${id}`)
      } else {
        const r = await chamarAction(criarMaterial(dados, codigo))
        if (!r.ok) return setErro(r.erro)
        router.push(`/materiais/${r.dados.id}`)
      }
      router.refresh()
    })
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="nome" className="mb-1 block text-sm font-medium">Nome do material *</label>
          <input
            id="nome" name="nome" required autoFocus defaultValue={valores.nome ?? ''}
            placeholder="Ex.: Cimento CP-II 50kg" className={CAMPO}
          />
        </div>

        <div>
          <label htmlFor="categoria" className="mb-1 block text-sm font-medium">Categoria *</label>
          <select
            id="categoria" name="categoria" required
            value={categoria} onChange={(e) => setCategoria(e.target.value)} className={CAMPO}
          >
            {Object.values(CATEGORIA_MATERIAL).map((c) => (
              <option key={c} value={c}>{ROTULO_CATEGORIA_MATERIAL[c]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="unidade" className="mb-1 block text-sm font-medium">Unidade *</label>
          <select id="unidade" name="unidade" required defaultValue={valores.unidade ?? 'UN'} className={CAMPO}>
            {UNIDADE.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">A mesma sigla que aparece na nota fiscal.</p>
        </div>

        <div>
          <label htmlFor="estoqueMinimo" className="mb-1 block text-sm font-medium">Estoque mínimo</label>
          <input
            id="estoqueMinimo" name="estoqueMinimo" type="number" min={0} step="any"
            defaultValue={valores.estoqueMinimo ?? ''} className={CAMPO}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Abaixo disso o item entra no alerta de compra. Deixe em branco se não controla reposição.
          </p>
        </div>

        <div>
          <label htmlFor="localizacao" className="mb-1 block text-sm font-medium">Localização</label>
          <input
            id="localizacao" name="localizacao" defaultValue={valores.localizacao ?? ''}
            placeholder="Ex.: Prateleira A3" className={CAMPO}
          />
        </div>

        {ehEpi && (
          <>
            <div>
              <label htmlFor="ca" className="mb-1 block text-sm font-medium">CA (Certificado de Aprovação)</label>
              <input id="ca" name="ca" defaultValue={valores.ca ?? ''} placeholder="Ex.: 31469" className={CAMPO} />
              <p className="mt-1 text-xs text-muted-foreground">
                Vai junto na ficha de entrega enviada ao RH — a NR-6 exige o número do CA no
                documento.
              </p>
            </div>
            <div>
              <label htmlFor="validadeCA" className="mb-1 block text-sm font-medium">Validade do CA</label>
              <input id="validadeCA" name="validadeCA" type="date" defaultValue={valores.validadeCA ?? ''} className={CAMPO} />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="observacao" className="mb-1 block text-sm font-medium">Observação</label>
          <textarea id="observacao" name="observacao" rows={2} defaultValue={valores.observacao ?? ''} className={CAMPO} />
        </div>
      </div>

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="submit" disabled={pendente} data-testid="salvar-material"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar material'}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
        {!id && (
          <p className="self-center text-xs text-muted-foreground">
            Código <span className="tabular font-medium">{codigo}</span>
          </p>
        )}
      </div>
    </form>
  )
}
