'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { criarLocacao } from '@/actions/locacoes'
import { PERIODOS } from '@/lib/dominio/constantes'
import { parseDataBR } from '@/lib/dominio/formato'

type Props = {
  obras: { id: string; codigo: string; cliente: string }[]
  fornecedores: { id: string; nome: string }[]
}

/** Hoje no relógio de quem está no canteiro — é o dia que o usuário espera ver no campo. */
const hoje = () => format(new Date(), 'yyyy-MM-dd')

/**
 * Avança dias de calendário sobre o valor de um `<input type="date">`.
 *
 * A conta é feita em UTC (`parseDataBR` devolve meia-noite UTC, e o passo usa `setUTCDate`)
 * porque é nesse referencial que o banco grava as datas. Somar milissegundos ou usar
 * componentes locais erra o dia numa virada de horário de verão — e é a mesma classe de bug
 * que já fez a tela dizer "vence em 7 dias" quando faltavam 8.
 */
function somarDias(iso: string, dias: number): string {
  const d = parseDataBR(iso)
  if (!d) return iso
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function FormLocacao({ obras, fornecedores }: Props) {
  const router = useRouter()
  const [inicio, setInicio] = useState(hoje)
  const [fim, setFim] = useState(() => somarDias(hoje(), 30))
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function aplicarPeriodo(dias: number) {
    if (!dias) return
    setFim(somarDias(inicio, dias))
  }

  function enviar(formData: FormData) {
    setErro(null)
    iniciar(async () => {
      const r = await criarLocacao({
        obraId: formData.get('obraId'),
        descricao: formData.get('descricao'),
        trCodigo: formData.get('trCodigo'),
        fornecedorId: formData.get('fornecedorId'),
        quantidade: formData.get('quantidade'),
        dataInicio: formData.get('dataInicio'),
        dataFim: formData.get('dataFim'),
        valorItem: formData.get('valorItem') || undefined,
        observacoes: formData.get('observacoes'),
      })
      if (!r.ok) return setErro(r.erro)
      router.push('/locacoes')
      router.refresh()
    })
  }

  const campo = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
  const rotulo = 'mb-1 block text-sm font-medium'

  return (
    <form action={enviar} data-testid="form-locacao"
          className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      {erro && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div>
        <label htmlFor="obraId" className={rotulo}>Obra *</label>
        <select id="obraId" name="obraId" required className={campo} defaultValue="">
          <option value="" disabled>Selecione a obra</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente} · {o.codigo}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="descricao" className={rotulo}>Equipamento *</label>
        <input id="descricao" name="descricao" required placeholder="MARTELETE 11KG" className={campo} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="trCodigo" className={rotulo}>Código Tr</label>
          <input id="trCodigo" name="trCodigo" className={campo} />
        </div>
        <div>
          <label htmlFor="quantidade" className={rotulo}>Quantidade</label>
          <input id="quantidade" name="quantidade" type="number" min="1" defaultValue="1" className={campo} />
        </div>
        <div>
          <label htmlFor="fornecedorId" className={rotulo}>Fornecedor</label>
          <select id="fornecedorId" name="fornecedorId" className={campo} defaultValue="">
            <option value="">Sem fornecedor</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Período</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="periodo" className={rotulo}>Período rápido</label>
            <select id="periodo" className={campo} defaultValue=""
                    onChange={(e) => aplicarPeriodo(Number(e.target.value))}>
              <option value="">Personalizado</option>
              {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.rotulo}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dataInicio" className={rotulo}>Início *</label>
            <input id="dataInicio" name="dataInicio" type="date" required
                   value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="dataFim" className={rotulo}>Fim *</label>
            <input id="dataFim" name="dataFim" type="date" required
                   value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="valorItem" className={rotulo}>Valor do item (R$)</label>
          <input id="valorItem" name="valorItem" type="number" step="0.01" min="0" className={campo} />
        </div>
        <div>
          <label htmlFor="observacoes" className={rotulo}>Observações</label>
          <input id="observacoes" name="observacoes" className={campo} />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={pendente}
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pendente ? 'Registrando...' : 'Registrar locação'}
        </button>
        <button type="button" onClick={() => router.back()}
                className="rounded-md border border-border px-4 py-2.5 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
