'use client'

import { Plus, TriangleAlert } from 'lucide-react'
import { useState, useTransition } from 'react'
import { registrarMovimentacao } from '@/actions/movimentacoes'
import {
  MOVIMENTACAO, ROTULO_MOVIMENTACAO, EXIGE_OBRA, EXIGE_FORNECEDOR, exigeFuncionario,
  type TipoMovimentacao,
} from '@/lib/dominio/constantes'
import type { Opcoes } from '@/queries/materiais'
import type { FuncionarioRh } from '@/lib/cliente-rh'

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function FormMovimentacao({
  opcoes, funcionarios, erroRh,
}: {
  opcoes: Opcoes
  funcionarios: FuncionarioRh[]
  erroRh: string | null
}) {
  const [aberto, setAberto] = useState(false)
  // Controlados porque o formulário muda de forma conforme a escolha: entrada pede
  // fornecedor e preço, saída pede obra, saída de EPI pede o funcionário que recebeu, e
  // perda não pede nenhum dos três.
  const [tipo, setTipo] = useState<TipoMovimentacao>(MOVIMENTACAO.ENTRADA)
  const [materialId, setMaterialId] = useState('')
  const [funcionarioId, setFuncionarioId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const material = opcoes.materiais.find((m) => m.id === materialId)
  const pedeFuncionario = material ? exigeFuncionario(tipo, material.categoria) : false
  // EPI sai para a pessoa; a obra vira informação de apoio, não o destino do lançamento.
  const pedeObra = EXIGE_OBRA.includes(tipo) && !pedeFuncionario
  const pedeFornecedor = EXIGE_FORNECEDOR.includes(tipo)
  const funcionarioEscolhido = funcionarios.find((f) => f.id === funcionarioId)

  function reiniciar() {
    setTipo(MOVIMENTACAO.ENTRADA)
    setMaterialId('')
    setFuncionarioId('')
    setErro(null)
  }

  // onSubmit + preventDefault, não `action={fn}`: o form action do React 19 reseta o DOM
  // do formulário assim que a função retorna, inclusive quando falha na validação — e os
  // selects controlados voltariam para a primeira opção sem o estado do React acompanhar,
  // deixando o próximo envio com dados diferentes do que aparece na tela.
  function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await registrarMovimentacao({
        ...Object.fromEntries(fd.entries()),
        // O nome viaja junto do id porque o extrato do almoxarifado precisa continuar
        // legível mesmo sem o RH no ar — ver o comentário no schema.
        funcionarioNome: funcionarioEscolhido?.nome ?? '',
      })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      reiniciar()
    })
  }

  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)} data-testid="nova-movimentacao"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Plus className="size-4" /> Nova movimentação
      </button>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tipo" className="mb-1 block text-sm font-medium">Tipo *</label>
          <select
            id="tipo" name="tipo" required value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMovimentacao)} className={CAMPO}
          >
            {Object.values(MOVIMENTACAO).map((t) => (
              <option key={t} value={t}>{ROTULO_MOVIMENTACAO[t]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="materialId" className="mb-1 block text-sm font-medium">Material *</label>
          <select
            id="materialId" name="materialId" required value={materialId}
            onChange={(e) => setMaterialId(e.target.value)} className={CAMPO}
          >
            <option value="">— selecione —</option>
            {opcoes.materiais.map((m) => (
              <option key={m.id} value={m.id}>{m.codigo} — {m.nome}</option>
            ))}
          </select>
          {opcoes.materiais.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhum material ativo cadastrado ainda — cadastre um antes de movimentar.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="quantidade" className="mb-1 block text-sm font-medium">
            Quantidade{material ? ` (${material.unidade})` : ''} *
          </label>
          <input
            id="quantidade" name="quantidade" type="number" min={0} step="any" required className={CAMPO}
          />
        </div>

        <div>
          <label htmlFor="ocorridoEm" className="mb-1 block text-sm font-medium">Data *</label>
          <input id="ocorridoEm" name="ocorridoEm" type="date" required defaultValue={hoje} className={CAMPO} />
        </div>

        {pedeObra && (
          <div>
            <label htmlFor="obraId" className="mb-1 block text-sm font-medium">Obra *</label>
            <select id="obraId" name="obraId" required defaultValue="" className={CAMPO}>
              <option value="" disabled>— selecione —</option>
              {opcoes.obras.map((o) => (
                <option key={o.id} value={o.id}>{o.codigo} — {o.descricao}</option>
              ))}
            </select>
          </div>
        )}

        {pedeFuncionario && (
          <div className="sm:col-span-2">
            <label htmlFor="funcionarioId" className="mb-1 block text-sm font-medium">
              Funcionário que recebeu *
            </label>
            <select
              id="funcionarioId" name="funcionarioId" required value={funcionarioId}
              onChange={(e) => setFuncionarioId(e.target.value)} className={CAMPO}
            >
              <option value="">— selecione —</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} — {f.matricula}{f.cargo ? ` · ${f.cargo}` : ''}{f.obraCodigo ? ` · ${f.obraCodigo}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              EPI sai para a pessoa, não para a obra: a NR-6 exige provar a quem cada
              equipamento foi entregue. Esta saída vira uma ficha no RH automaticamente
              {material?.ca ? `, com o CA ${material.ca}` : ''}.
            </p>
            {erroRh && (
              <p className="mt-2 flex items-start gap-2 rounded-md border border-status-atencao/40 bg-status-atencao/10 p-2 text-xs">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-status-atencao" />
                <span>
                  Não consegui carregar a lista de funcionários do RH ({erroRh}) — sem ela não
                  dá para registrar saída de EPI. Ligue o módulo de RH e recarregue esta página.
                </span>
              </p>
            )}
          </div>
        )}

        {pedeFornecedor && (
          <>
            <div>
              <label htmlFor="fornecedorId" className="mb-1 block text-sm font-medium">Fornecedor</label>
              <select id="fornecedorId" name="fornecedorId" defaultValue="" className={CAMPO}>
                <option value="">— não informar —</option>
                {opcoes.fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="valorUnitario" className="mb-1 block text-sm font-medium">
                Preço por {material?.unidade ?? 'unidade'}
              </label>
              <input
                id="valorUnitario" name="valorUnitario" type="number" min={0} step="0.01" className={CAMPO}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Usado para calcular o valor em estoque. Use ponto para centavos.
              </p>
            </div>
          </>
        )}

        <div>
          <label htmlFor="documento" className="mb-1 block text-sm font-medium">Documento</label>
          <input id="documento" name="documento" placeholder="Nota fiscal, requisição…" className={CAMPO} />
        </div>
      </div>

      <div>
        <label htmlFor="observacao" className="mb-1 block text-sm font-medium">Observação</label>
        <textarea id="observacao" name="observacao" rows={2} className={CAMPO} />
      </div>

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit" disabled={pendente} data-testid="salvar-movimentacao"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Registrando…' : 'Registrar'}
        </button>
        <button
          type="button" onClick={() => { setAberto(false); reiniciar() }}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
