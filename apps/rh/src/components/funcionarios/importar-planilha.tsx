'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Upload, CircleCheck, CircleAlert, FileSpreadsheet, TriangleAlert } from 'lucide-react'
import { gerarPrevia, importar, type Previa, type ResumoImportacao } from '@/actions/importar-funcionarios'

/**
 * Importação em dois passos: ver e confirmar.
 *
 * O primeiro passo não grava nada — mostra quem entra, quem já existe, quais cargos e obras
 * serão criados e quais linhas foram descartadas. Uma planilha com a coluna trocada criaria
 * cem cadastros errados, e desfazer isso é apagar um por um.
 */
export function ImportarPlanilha() {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function conferir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    setResumo(null)
    iniciar(async () => {
      const r = await gerarPrevia(fd)
      if (!r.ok) return setErro(r.erro)
      setPrevia(r.dados)
    })
  }

  function confirmar() {
    const arquivo = entrada.current?.files?.[0]
    if (!arquivo) return setErro('O arquivo se perdeu. Escolha de novo.')
    const fd = new FormData()
    fd.set('arquivo', arquivo)
    setErro(null)
    iniciar(async () => {
      const r = await importar(fd)
      if (!r.ok) return setErro(r.erro)
      setPrevia(null)
      setResumo(r.dados)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={conferir} className="space-y-3 rounded-lg border border-border bg-card p-4">
        <label htmlFor="arquivo" className="block text-sm font-medium">Planilha de funcionários</label>
        <input
          ref={entrada} id="arquivo" name="arquivo" type="file" required
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={() => { setPrevia(null); setResumo(null); setErro(null) }}
          data-testid="arquivo-planilha"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                     file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
        />

        <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">O que a planilha precisa ter</p>
          <p className="mt-1">
            Uma linha de cabeçalho com <strong>Nome</strong> e <strong>CPF</strong> — sem essas
            duas o arquivo é recusado. As outras colunas são aproveitadas se existirem:
            matrícula, admissão, cargo, obra, RG, nascimento, telefone, e-mail, sexo, salário,
            cidade, UF e os tamanhos de camisa, calça e calçado.
          </p>
          <p className="mt-1.5">
            A ordem das colunas não importa, e nomes parecidos são reconhecidos
            (&quot;Função&quot; vale como cargo, &quot;Centro de custo&quot; vale como obra).
            O cabeçalho pode estar até na décima linha, se houver título em cima.
          </p>
        </div>

        <button
          type="submit" disabled={pendente} data-testid="conferir-planilha"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Upload className="size-4" /> {pendente ? 'Lendo…' : 'Conferir antes de importar'}
        </button>
      </form>

      {erro && (
        <p role="alert" data-testid="erro-importacao" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      {resumo && (
        <div className="rounded-lg border border-status-ativa/40 bg-status-ativa/10 p-4" data-testid="resumo-importacao">
          <p className="flex items-center gap-2 font-medium">
            <CircleCheck className="size-4 text-status-ativa" />
            {resumo.criados} {resumo.criados === 1 ? 'funcionário cadastrado' : 'funcionários cadastrados'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {resumo.cargosCriados > 0 && `${resumo.cargosCriados} cargos criados. `}
            {resumo.obrasCriadas > 0 && `${resumo.obrasCriadas} obras criadas. `}
            {resumo.pulados > 0 && `${resumo.pulados} linhas puladas (já existiam ou falharam).`}
          </p>
        </div>
      )}

      {previa && <Conferencia previa={previa} pendente={pendente} aoConfirmar={confirmar} aoCancelar={() => setPrevia(null)} />}
    </div>
  )
}

function Conferencia({
  previa, pendente, aoConfirmar, aoCancelar,
}: {
  previa: Previa; pendente: boolean; aoConfirmar: () => void; aoCancelar: () => void
}) {
  const [verTodas, setVerTodas] = useState(false)
  const mostradas = verTodas ? previa.itens : previa.itens.slice(0, 25)

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-card p-4" data-testid="previa-importacao">
      <h2 className="text-sm font-semibold">Confira antes de gravar</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo="Entram" valor={previa.novos} tom="bom" />
        <Numero rotulo="Já no RH" valor={previa.jaExistem} tom="neutro" />
        <Numero rotulo="Descartadas" valor={previa.ignoradas.length} tom={previa.ignoradas.length ? 'alerta' : 'neutro'} />
        <Numero rotulo="Sem admissão" valor={previa.semAdmissao} tom={previa.semAdmissao ? 'alerta' : 'neutro'} />
      </div>

      {previa.colunasIgnoradas.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground">
          <FileSpreadsheet className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Colunas que não reconheci e vou ignorar: {previa.colunasIgnoradas.join(', ')}.
          </span>
        </p>
      )}

      {(previa.cargosNovos.length > 0 || previa.obrasNovas.length > 0) && (
        <div className="rounded-md border border-status-atencao/40 bg-status-atencao/10 p-2.5 text-xs">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert className="size-3.5 text-status-atencao" /> Serão criados junto
          </p>
          {previa.cargosNovos.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              <strong>Cargos:</strong> {previa.cargosNovos.join(', ')}
            </p>
          )}
          {previa.obrasNovas.length > 0 && (
            <p className="mt-0.5 text-muted-foreground">
              <strong>Obras:</strong> {previa.obrasNovas.join(', ')}
            </p>
          )}
          <p className="mt-1 text-muted-foreground">
            Confira se não é o mesmo cargo escrito de outro jeito — &quot;Pedreiro&quot; e
            &quot;PEDREIRO(A)&quot; virariam dois.
          </p>
        </div>
      )}

      {previa.semAdmissao > 0 && (
        <p className="text-xs text-muted-foreground">
          {previa.semAdmissao} linhas sem data de admissão entram com a data de hoje — corrija
          depois na ficha de cada uma.
        </p>
      )}

      <div className="max-h-80 overflow-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Nome</th>
              <th className="px-2 py-1.5 text-left font-medium">CPF</th>
              <th className="px-2 py-1.5 text-left font-medium">Cargo</th>
              <th className="px-2 py-1.5 text-left font-medium">Obra</th>
              <th className="px-2 py-1.5 text-left font-medium">Admissão</th>
              <th className="px-2 py-1.5 text-left font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {mostradas.map((i) => (
              <tr key={i.linha} className={`border-t border-border ${i.situacao === 'JA_EXISTE' ? 'opacity-50' : ''}`}>
                <td className="px-2 py-1">{i.nome}</td>
                <td className="px-2 py-1 tabular">{i.cpf}</td>
                <td className="px-2 py-1">{i.cargo ?? '—'}{i.criaCargo && <span className="text-status-atencao"> +</span>}</td>
                <td className="px-2 py-1">{i.obra ?? '—'}{i.criaObra && <span className="text-status-atencao"> +</span>}</td>
                <td className="px-2 py-1 tabular">{i.admitidoEm ?? '—'}</td>
                <td className="px-2 py-1">
                  {i.situacao === 'NOVO'
                    ? <span className="text-status-ativa">entra</span>
                    : <span className="text-muted-foreground">já existe</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previa.itens.length > 25 && (
        <button type="button" onClick={() => setVerTodas((v) => !v)} className="text-xs text-primary underline underline-offset-2">
          {verTodas ? 'Mostrar só as 25 primeiras' : `Ver todas as ${previa.itens.length} linhas`}
        </button>
      )}

      {previa.ignoradas.length > 0 && (
        <details className="rounded-md border border-border p-2.5 text-xs">
          <summary className="cursor-pointer font-medium">
            {previa.ignoradas.length} linhas descartadas — ver motivos
          </summary>
          <ul className="mt-2 space-y-0.5 text-muted-foreground">
            {previa.ignoradas.slice(0, 50).map((g) => (
              <li key={g.linha}>
                <span className="tabular">linha {g.linha}</span>: {g.motivo} — {g.conteudo}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <button
          type="button" onClick={aoConfirmar} disabled={pendente || previa.novos === 0}
          data-testid="confirmar-importacao"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Importando…' : `Importar ${previa.novos} funcionários`}
        </button>
        <button type="button" onClick={aoCancelar} className="rounded-md border border-border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>

      {previa.novos === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleAlert className="size-3.5" /> Nenhum funcionário novo — todos os CPFs já estão no RH.
        </p>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: number; tom: 'bom' | 'alerta' | 'neutro' }) {
  const cor =
    tom === 'bom' ? 'border-status-ativa/40 bg-status-ativa/10 text-status-ativa'
    : tom === 'alerta' ? 'border-status-atencao/40 bg-status-atencao/10 text-status-atencao'
    : 'border-border bg-muted/40'
  return (
    <div className={`rounded-md border p-2.5 ${cor}`}>
      <p className="text-[11px] uppercase leading-none tracking-wide opacity-80">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular">{valor}</p>
    </div>
  )
}
