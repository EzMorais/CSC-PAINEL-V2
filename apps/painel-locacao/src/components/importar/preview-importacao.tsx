'use client'

import { useState, useTransition } from 'react'
import { confirmarImportacao, gerarPrevia, receberUpload, type PreviaImportacao } from '@/actions/importar'

// Classes completas, nunca interpoladas: o Tailwind precisa ver a string
// inteira no fonte para gerar a cor. A forma nomeada (text-status-ativa) é a
// que de fato aplica a cor — a variante com colchete crua não aplica.
type CampoContado = 'ativos' | 'devolvidos' | 'perdidos' | 'aConfirmar' | 'possiveisDuplicatas'

const CARTOES: { rotulo: string; campo: CampoContado; valor: string; borda: string }[] = [
  { rotulo: 'Ativas',              campo: 'ativos',              valor: 'text-status-ativa',      borda: 'border-l-status-ativa' },
  { rotulo: 'Devolvidas',          campo: 'devolvidos',          valor: 'text-status-devolvida',  borda: 'border-l-status-devolvida' },
  { rotulo: 'Itens perdidos',      campo: 'perdidos',            valor: 'text-status-perdido',    borda: 'border-l-status-perdido' },
  { rotulo: 'Obra a confirmar',    campo: 'aConfirmar',          valor: 'text-status-atencao',    borda: 'border-l-status-atencao' },
  { rotulo: 'Possíveis duplicatas', campo: 'possiveisDuplicatas', valor: 'text-status-atencao',   borda: 'border-l-status-atencao' },
]

export function PreviewImportacao() {
  const [caminho, setCaminho] = useState<string | null>(null)
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [concluido, setConcluido] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(formData: FormData) {
    setErro(null); setConcluido(null); setPrevia(null)
    iniciar(async () => {
      const upload = await receberUpload(formData)
      if (!upload.ok) return setErro(upload.erro)
      setCaminho(upload.dados.caminho)
      const p = await gerarPrevia(upload.dados.caminho)
      if (!p.ok) return setErro(p.erro)
      setPrevia(p.dados)
    })
  }

  function confirmar() {
    if (!caminho) return
    setErro(null)
    iniciar(async () => {
      const r = await confirmarImportacao(caminho)
      if (!r.ok) return setErro(r.erro)
      setConcluido(
        `${r.dados.criadas} locações criadas, ${r.dados.puladas} já existiam` +
        (r.dados.fornecedoresCriados ? `, ${r.dados.fornecedoresCriados} fornecedores novos` : '')
      )
      setPrevia(null)
    })
  }

  return (
    <div className="space-y-6">
      <form action={enviar} className="rounded-lg border border-border bg-card p-6">
        <label htmlFor="planilha" className="mb-2 block text-sm font-medium">
          Planilha de controle (.xlsx)
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="planilha" name="planilha" type="file" accept=".xlsx,.xlsm" required
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm
                       file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5
                       file:text-sm file:text-primary-foreground"
          />
          <button
            type="submit" disabled={pendente}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground
                       disabled:opacity-50"
          >
            {pendente ? 'Lendo...' : 'Analisar'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Analisar apenas lê o arquivo. A gravação só acontece quando você confirmar.
        </p>
      </form>

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {erro}
        </div>
      )}

      {concluido && (
        <div role="status" data-testid="importacao-concluida" className="rounded-lg border border-status-ativa/50 bg-status-ativa/10 p-4 text-sm text-status-ativa">
          Importação concluída: {concluido}
        </div>
      )}

      {previa && (
        <div data-testid="previa" className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Prévia — nada foi gravado ainda</h2>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {CARTOES.map(({ rotulo, campo, valor, borda }) => (
              <div key={campo} data-testid={`previa-${campo}`} className={`rounded-md border border-l-4 border-border p-3 ${borda}`}>
                <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                <dd className={`text-2xl font-semibold tabular-nums ${valor}`}>{previa[campo]}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-muted-foreground">
            Possíveis duplicatas são equipamentos que aparecem em mais de uma obra na planilha.
            Eles serão importados marcados para revisão, não descartados.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Aba</th>
                  <th className="py-2 pr-4 text-right font-medium">Ativas</th>
                  <th className="py-2 text-right font-medium">Devolvidas</th>
                </tr>
              </thead>
              <tbody>
                {previa.porAba.map((a) => (
                  <tr key={a.aba} className="border-b border-border/50">
                    <td className="py-2 pr-4">{a.aba}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{a.ativos}</td>
                    <td className="py-2 text-right tabular-nums">{a.devolvidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previa.fornecedoresNovos.length > 0 && (
            <div className="rounded-md border border-status-atencao/50 bg-status-atencao/10 p-4 text-sm">
              <p className="font-medium">Fornecedores que serão criados ({previa.fornecedoresNovos.length}):</p>
              <p className="mt-1 text-muted-foreground">{previa.fornecedoresNovos.join(' · ')}</p>
            </div>
          )}

          {previa.ignoradas.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
              <p className="font-medium">Linhas não interpretadas ({previa.ignoradas.length}):</p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {previa.ignoradas.map((i, n) => (
                  <li key={n}>{i.aba} linha {i.linha}: {i.motivo}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={confirmar} disabled={pendente}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            {pendente ? 'Importando...' : `Confirmar importação de ${previa.total} registros`}
          </button>
        </div>
      )}
    </div>
  )
}
