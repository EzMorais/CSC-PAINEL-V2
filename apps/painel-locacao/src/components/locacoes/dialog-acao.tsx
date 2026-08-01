'use client'

import { useEffect, useState, useTransition } from 'react'
import { format } from 'date-fns'
import {
  carregarLocacao,
  devolverLocacao,
  editarLocacao,
  renovarLocacao,
  transferirLocacao,
  type Resultado,
} from '@/actions/locacoes'
import { PERIODOS } from '@/lib/dominio/constantes'
import { parseDataBR } from '@/lib/dominio/formato'

export type Acao = 'editar' | 'renovar' | 'devolver' | 'transferir'

type Props = {
  acao: Acao
  locacaoId: string
  obras: { id: string; codigo: string; cliente: string }[]
  aoFechar: () => void
  aoConcluir: () => void
}

type Detalhe = NonNullable<Awaited<ReturnType<typeof carregarLocacao>>>

const TITULOS: Record<Acao, string> = {
  editar: 'Editar locação',
  renovar: 'Renovar período',
  devolver: 'Registrar devolução',
  transferir: 'Transferir para outra obra',
}

/** Hoje no relógio de quem está no canteiro. */
const hojeISO = () => format(new Date(), 'yyyy-MM-dd')

/** Valor de `<input type="date">` a partir de uma data ARMAZENADA (meia-noite UTC). */
function isoDeData(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

/**
 * Avança dias de calendário sobre o valor de um `<input type="date">`, em UTC — o mesmo
 * referencial em que o banco grava. Componentes locais erram o dia numa virada de fuso.
 */
function somarDias(iso: string, dias: number): string {
  const d = parseDataBR(iso)
  if (!d) return iso
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Converte um campo de data do formulário para o Date gravado no banco: meia-noite UTC
 * representando o dia de calendário escolhido. `new Date(valor)` cru ou o construtor local
 * jogariam a data para o dia anterior no Brasil (UTC−3).
 */
function dataDoCampo(valor: FormDataEntryValue | null): Date | null {
  return valor ? parseDataBR(String(valor)) : null
}

export function DialogAcao({ acao, locacaoId, obras, aoFechar, aoConcluir }: Props) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [inicio, setInicio] = useState(hojeISO)
  const [fim, setFim] = useState(() => somarDias(hojeISO(), 30))

  // Estado derivado de prop: se o painel trocar de ação/item sem desmontar o diálogo,
  // zeramos no próprio render em vez de num efeito, senão um quadro seria pintado com os
  // dados do item anterior sob o título do novo.
  const chave = `${acao}:${locacaoId}`
  const [chaveExibida, setChaveExibida] = useState(chave)
  if (chave !== chaveExibida) {
    setChaveExibida(chave)
    setDetalhe(null)
    setErro(null)
  }

  // O formulário só é montado depois que o detalhe chega: a lista de obras de destino
  // exclui a obra atual, e renderizá-la antes deixaria a origem selecionável por um quadro.
  useEffect(() => {
    let vivo = true
    carregarLocacao(locacaoId).then((d) => {
      if (!vivo) return
      if (!d) return setErro('Locação não encontrada.')
      setDetalhe(d)
      if (d.dataInicio) setInicio(isoDeData(d.dataInicio))
      if (d.dataFim) setFim(isoDeData(d.dataFim))
    })
    return () => { vivo = false }
  }, [locacaoId])

  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [aoFechar])

  function enviar(formData: FormData) {
    setErro(null)
    iniciar(async () => {
      let r: Resultado<unknown>

      if (acao === 'renovar') {
        const dias = formData.get('dias')
        r = await renovarLocacao(locacaoId, dias ? Number(dias) : undefined)
      } else if (acao === 'devolver') {
        const data = dataDoCampo(formData.get('data'))
        if (!data) return setErro('Informe a data da devolução.')
        r = await devolverLocacao(locacaoId, data, String(formData.get('motivo') || '') || undefined)
      } else if (acao === 'transferir') {
        const de = dataDoCampo(formData.get('inicio'))
        const ate = dataDoCampo(formData.get('fim'))
        if (!de || !ate) return setErro('Informe o período na obra de destino.')
        r = await transferirLocacao(
          locacaoId,
          String(formData.get('obraDestinoId')),
          de,
          ate,
          String(formData.get('motivo') || '') || undefined,
        )
      } else {
        const de = dataDoCampo(formData.get('dataInicio'))
        const ate = dataDoCampo(formData.get('dataFim'))
        if (!de || !ate) return setErro('Informe o período da locação.')
        r = await editarLocacao(locacaoId, {
          descricao: formData.get('descricao'),
          trCodigo: formData.get('trCodigo'),
          quantidade: formData.get('quantidade'),
          dataInicio: de,
          dataFim: ate,
          valorItem: formData.get('valorItem') || undefined,
          observacoes: formData.get('observacoes'),
        })
      }

      if (!r.ok) return setErro(r.erro)
      aoConcluir()
    })
  }

  const campo = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
  const rotulo = 'mb-1 block text-sm font-medium'
  const carregando = !detalhe && !erro

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={aoFechar} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={TITULOS[acao]} data-testid={`dialog-${acao}`}
           className="fixed left-1/2 top-1/2 z-[70] max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-md
                      -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border
                      bg-card p-5 shadow-lg">
        <h2 className="mb-1 font-semibold">{TITULOS[acao]}</h2>
        {detalhe && (
          <p className="mb-4 truncate text-xs text-muted-foreground">
            {detalhe.descricao} · {detalhe.obra.cliente} · {detalhe.obra.codigo}
          </p>
        )}

        {erro && (
          <div role="alert" className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {erro}
          </div>
        )}

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !detalhe ? null : (
          <form action={enviar} className="space-y-3">
            {acao === 'renovar' && (
              <div>
                <label htmlFor="dias" className={rotulo}>Dias a acrescentar</label>
                <input id="dias" name="dias" type="number" min="1"
                       placeholder="Deixe vazio para repetir o período atual" className={campo} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Em branco, renova pela mesma duração do período vigente.
                </p>
              </div>
            )}

            {acao === 'devolver' && (
              <>
                <div>
                  <label htmlFor="data" className={rotulo}>Data da devolução *</label>
                  <input id="data" name="data" type="date" required defaultValue={hojeISO()} className={campo} />
                </div>
                <div>
                  <label htmlFor="motivo" className={rotulo}>Motivo</label>
                  <input id="motivo" name="motivo" className={campo} />
                </div>
                <p className="text-xs text-muted-foreground">
                  A locação continua no histórico com a data de início original — devolver não apaga a linha.
                </p>
              </>
            )}

            {acao === 'transferir' && (
              <>
                <div>
                  <label htmlFor="obraDestinoId" className={rotulo}>Obra de destino *</label>
                  <select id="obraDestinoId" name="obraDestinoId" required className={campo} defaultValue="">
                    <option value="" disabled>Selecione</option>
                    {obras
                      .filter((o) => o.id !== detalhe?.obra.id)
                      .map((o) => <option key={o.id} value={o.id}>{o.cliente} · {o.codigo}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="periodo" className={rotulo}>Período rápido</label>
                  <select id="periodo" className={campo} defaultValue=""
                          onChange={(e) => { const d = Number(e.target.value); if (d) setFim(somarDias(inicio, d)) }}>
                    <option value="">Personalizado</option>
                    {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.rotulo}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="inicio" className={rotulo}>Início *</label>
                    <input id="inicio" name="inicio" type="date" required
                           value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
                  </div>
                  <div>
                    <label htmlFor="fim" className={rotulo}>Fim *</label>
                    <input id="fim" name="fim" type="date" required
                           value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
                  </div>
                </div>
                <div>
                  <label htmlFor="motivo" className={rotulo}>Motivo</label>
                  <input id="motivo" name="motivo" className={campo} />
                </div>
              </>
            )}

            {acao === 'editar' && detalhe && (
              <>
                <div>
                  <label htmlFor="descricao" className={rotulo}>Equipamento *</label>
                  <input id="descricao" name="descricao" required defaultValue={detalhe.descricao} className={campo} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="trCodigo" className={rotulo}>Código Tr</label>
                    <input id="trCodigo" name="trCodigo" defaultValue={detalhe.trCodigo ?? ''} className={campo} />
                  </div>
                  <div>
                    <label htmlFor="quantidade" className={rotulo}>Quantidade</label>
                    <input id="quantidade" name="quantidade" type="number" min="1"
                           defaultValue={detalhe.quantidade} className={campo} />
                  </div>
                </div>
                <div>
                  <label htmlFor="periodo" className={rotulo}>Período rápido</label>
                  <select id="periodo" className={campo} defaultValue=""
                          onChange={(e) => { const d = Number(e.target.value); if (d) setFim(somarDias(inicio, d)) }}>
                    <option value="">Personalizado</option>
                    {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.rotulo}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="valorItem" className={rotulo}>Valor do item (R$)</label>
                    <input id="valorItem" name="valorItem" type="number" step="0.01" min="0"
                           defaultValue={detalhe.valorItem ?? ''} className={campo} />
                  </div>
                  <div>
                    <label htmlFor="observacoes" className={rotulo}>Observações</label>
                    <input id="observacoes" name="observacoes" defaultValue={detalhe.observacoes ?? ''} className={campo} />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={pendente}
                      className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {pendente ? 'Aplicando...' : 'Confirmar'}
              </button>
              <button type="button" onClick={aoFechar}
                      className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
