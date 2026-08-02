'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { criarFuncionario, editarFuncionario } from '@/actions/funcionarios'
import { criarCargo } from '@/actions/cargos'
import { STATUS, TIPO_CONTRATO, ROTULO_STATUS, RISCO_CARGO, type Status } from '@/lib/dominio/constantes'

export type Opcoes = {
  obras: Array<{ id: string; codigo: string; descricao: string }>
  cargos: Array<{ id: string; nome: string }>
}

export type ValoresFuncionario = Partial<Record<string, string>>

type Props = {
  /** null = cadastro novo. */
  id: string | null
  matricula: string
  valores?: ValoresFuncionario
  opcoes: Opcoes
}

const ABAS = [
  { chave: 'pessoais', rotulo: 'Dados pessoais' },
  { chave: 'contato', rotulo: 'Contato e endereço' },
  { chave: 'contrato', rotulo: 'Contrato' },
  { chave: 'banco', rotulo: 'Banco' },
  { chave: 'vestuario', rotulo: 'Vestuário' },
  { chave: 'observacoes', rotulo: 'Observações' },
] as const

type Aba = (typeof ABAS)[number]['chave']

const CAMPO =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Campo({
  nome, rotulo, tipo = 'text', valor, obrigatorio, dica, children,
}: {
  nome: string
  rotulo: string
  tipo?: string
  valor?: string
  obrigatorio?: boolean
  dica?: string
  children?: ReactNode
}) {
  return (
    <div>
      <label htmlFor={nome} className="mb-1 block text-sm font-medium">
        {rotulo}
        {obrigatorio ? ' *' : ''}
      </label>
      {children ?? (
        <input id={nome} name={nome} type={tipo} defaultValue={valor ?? ''} required={obrigatorio} className={CAMPO} />
      )}
      {dica && <p className="mt-1 text-xs text-muted-foreground">{dica}</p>}
    </div>
  )
}

export function FormFuncionario({ id, matricula, valores = {}, opcoes }: Props) {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('pessoais')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  // Cargo não tinha nenhuma tela de cadastro, só o seed — isto resolve "preciso de um
  // cargo que ainda não existe" sem sair do formulário do funcionário. A lista criada
  // aqui fica só no cliente (cargosExtra); o próximo carregamento da página já traz o
  // cargo novo junto de `opcoes.cargos`, vindo do banco.
  const [cargosExtra, setCargosExtra] = useState<Array<{ id: string; nome: string }>>([])
  const [criandoCargo, setCriandoCargo] = useState(false)
  const [nomeCargo, setNomeCargo] = useState('')
  const [riscoCargo, setRiscoCargo] = useState<(typeof RISCO_CARGO)[number]>('NORMAL')
  const [erroCargo, setErroCargo] = useState<string | null>(null)
  const [pendenteCargo, iniciarCargo] = useTransition()
  // Cargo recém-criado que ainda precisa ser selecionado no <select> assim que a opção
  // dele existir no DOM — ver o efeito abaixo.
  const [cargoParaSelecionar, setCargoParaSelecionar] = useState<string | null>(null)
  const selectCargoRef = useRef<HTMLSelectElement>(null)
  const cargosTotais = [...opcoes.cargos, ...cargosExtra]

  // Setar `select.value` logo após `setCargosExtra` não funciona: o setState é
  // assíncrono, então nesse instante a <option> nova ainda não existe no DOM, e o
  // navegador ignora silenciosamente um valor sem opção correspondente — o select fica
  // em branco. Este efeito roda depois do commit, quando a opção já está renderizada.
  useEffect(() => {
    if (cargoParaSelecionar && selectCargoRef.current) {
      selectCargoRef.current.value = cargoParaSelecionar
      setCargoParaSelecionar(null)
    }
  }, [cargoParaSelecionar, cargosExtra])

  // Não é um <form> aninhado dentro do <form> principal de propósito: HTML não permite
  // form dentro de form (o navegador ignora o de dentro), e o clique em "Criar cargo"
  // estava na prática submetendo o formulário do funcionário inteiro. Por isso os campos
  // aqui são controlados e lidos direto do estado, sem FormData.
  function adicionarCargo() {
    setErroCargo(null)
    iniciarCargo(async () => {
      const r = await criarCargo({ nome: nomeCargo, risco: riscoCargo })
      if (!r.ok) return setErroCargo(r.erro)
      setCargosExtra((atuais) => [...atuais, r.dados])
      setCargoParaSelecionar(r.dados.id)
      setCriandoCargo(false)
      setNomeCargo('')
      setRiscoCargo('NORMAL')
    })
  }

  function enviar(fd: FormData) {
    setErro(null)
    const dados = Object.fromEntries(fd.entries())

    iniciar(async () => {
      // Os dois ramos são tratados separados porque só a criação devolve um id — juntar
      // num `Resultado` só faria `dados` virar `void | { id }` e obrigar a um cast.
      if (id) {
        const r = await editarFuncionario(id, dados)
        if (!r.ok) return falhar(r.erro)
        router.push(`/funcionarios/${id}`)
      } else {
        const r = await criarFuncionario(dados, matricula)
        if (!r.ok) return falhar(r.erro)
        router.push(`/funcionarios/${r.dados.id}`)
      }
      router.refresh()
    })
  }

  function falhar(mensagem: string) {
    setErro(mensagem)
    // O erro quase sempre é de um campo obrigatório, que vive na primeira aba. Sem isto
    // a mensagem aparece e o campo culpado fica escondido atrás de outra aba.
    setAba('pessoais')
  }

  return (
    <form action={enviar} className="space-y-4">
      {/* Rolagem horizontal própria: 6 abas não cabem em 390px, e a página não pode
          rolar de lado por causa disso. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" aria-label="Seções do cadastro" className="flex w-max gap-1 border-b border-border">
          {ABAS.map(({ chave, rotulo }) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={aba === chave}
              onClick={() => setAba(chave)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
                aba === chave
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <p role="alert" data-testid="erro-form" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      {/*
        Todas as abas ficam montadas e são escondidas por CSS.
        Desmontar apagaria o que já foi digitado nas outras — os campos são
        não-controlados (defaultValue), então o valor mora no DOM, não no estado.
      */}
      <div className={aba === 'pessoais' ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}>
        <Campo nome="nome" rotulo="Nome completo" valor={valores.nome} obrigatorio />
        <Campo nome="cpf" rotulo="CPF" valor={valores.cpf} obrigatorio dica="Os dígitos verificadores são conferidos." />
        <Campo nome="rg" rotulo="RG" valor={valores.rg} />
        <Campo nome="dataNascimento" rotulo="Data de nascimento" tipo="date" valor={valores.dataNascimento} />
        <Campo nome="sexo" rotulo="Sexo" valor={valores.sexo}>
          <select id="sexo" name="sexo" defaultValue={valores.sexo ?? ''} className={CAMPO}>
            <option value="">—</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
            <option value="OUTRO">Outro</option>
          </select>
        </Campo>
        <Campo nome="estadoCivil" rotulo="Estado civil" valor={valores.estadoCivil} />
        <Campo nome="nomeMae" rotulo="Nome da mãe" valor={valores.nomeMae} />
      </div>

      <div className={aba === 'contato' ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}>
        <Campo nome="telefone" rotulo="Telefone" valor={valores.telefone} />
        <Campo nome="email" rotulo="E-mail" tipo="email" valor={valores.email} />
        <Campo nome="cep" rotulo="CEP" valor={valores.cep} />
        <Campo nome="logradouro" rotulo="Logradouro" valor={valores.logradouro} />
        <Campo nome="numero" rotulo="Número" valor={valores.numero} />
        <Campo nome="complemento" rotulo="Complemento" valor={valores.complemento} />
        <Campo nome="bairro" rotulo="Bairro" valor={valores.bairro} />
        <Campo nome="cidade" rotulo="Cidade" valor={valores.cidade} />
        <Campo nome="uf" rotulo="UF" valor={valores.uf} />
      </div>

      <div className={aba === 'contrato' ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}>
        <Campo nome="admitidoEm" rotulo="Data de admissão" tipo="date" valor={valores.admitidoEm} obrigatorio />
        <Campo nome="status" rotulo="Situação">
          <select id="status" name="status" defaultValue={valores.status ?? STATUS.ATIVO} className={CAMPO}>
            {Object.values(STATUS).map((s) => (
              <option key={s} value={s}>{ROTULO_STATUS[s as Status]}</option>
            ))}
          </select>
        </Campo>
        <Campo nome="tipoContrato" rotulo="Tipo de contrato">
          <select id="tipoContrato" name="tipoContrato" defaultValue={valores.tipoContrato ?? 'CLT'} className={CAMPO}>
            {TIPO_CONTRATO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo nome="obraId" rotulo="Obra">
          <select id="obraId" name="obraId" defaultValue={valores.obraId ?? ''} className={CAMPO}>
            <option value="">— sem obra —</option>
            {opcoes.obras.map((o) => (
              <option key={o.id} value={o.id}>{o.codigo} — {o.descricao}</option>
            ))}
          </select>
        </Campo>
        <Campo nome="cargoId" rotulo="Cargo">
          <div className="flex gap-2">
            <select
              ref={selectCargoRef} id="cargoId" name="cargoId"
              defaultValue={valores.cargoId ?? ''} className={CAMPO}
            >
              <option value="">— sem cargo —</option>
              {cargosTotais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button
              type="button" onClick={() => setCriandoCargo((v) => !v)}
              title="Novo cargo" aria-label="Novo cargo"
              className="grid size-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {criandoCargo && (
            <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  data-testid="novo-cargo-nome"
                  value={nomeCargo} onChange={(e) => setNomeCargo(e.target.value)}
                  placeholder="Nome do cargo" autoFocus className={CAMPO}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarCargo() } }}
                />
                <select
                  data-testid="novo-cargo-risco"
                  value={riscoCargo}
                  onChange={(e) => setRiscoCargo(e.target.value as (typeof RISCO_CARGO)[number])}
                  className={CAMPO}
                >
                  {RISCO_CARGO.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {erroCargo && <p role="alert" className="text-xs text-destructive">{erroCargo}</p>}
              <div className="flex gap-2">
                <button
                  data-testid="criar-cargo"
                  type="button" onClick={adicionarCargo} disabled={pendenteCargo || !nomeCargo.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {pendenteCargo ? 'Criando…' : 'Criar cargo'}
                </button>
                <button
                  type="button" onClick={() => { setCriandoCargo(false); setErroCargo(null); setNomeCargo('') }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </Campo>
        <Campo nome="salario" rotulo="Salário" tipo="number" valor={valores.salario} dica="Use ponto para centavos." />
      </div>

      <div className={aba === 'banco' ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}>
        <Campo nome="banco" rotulo="Banco" valor={valores.banco} />
        <Campo nome="agencia" rotulo="Agência" valor={valores.agencia} />
        <Campo nome="conta" rotulo="Conta" valor={valores.conta} />
        <Campo nome="tipoConta" rotulo="Tipo de conta" valor={valores.tipoConta} />
        <Campo nome="chavePix" rotulo="Chave PIX" valor={valores.chavePix} />
      </div>

      <div className={aba === 'vestuario' ? 'grid gap-3 sm:grid-cols-3' : 'hidden'}>
        <Campo nome="tamanhoCamisa" rotulo="Camisa" valor={valores.tamanhoCamisa} dica="P, M, G, GG…" />
        <Campo nome="tamanhoCalca" rotulo="Calça" valor={valores.tamanhoCalca} />
        <Campo nome="tamanhoCalcado" rotulo="Calçado" valor={valores.tamanhoCalcado} />
      </div>

      <div className={aba === 'observacoes' ? 'block' : 'hidden'}>
        <label htmlFor="observacoes" className="mb-1 block text-sm font-medium">Observações</label>
        <textarea
          id="observacoes" name="observacoes" rows={5}
          defaultValue={valores.observacoes ?? ''} className={CAMPO}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="submit"
          disabled={pendente}
          data-testid="salvar"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar funcionário'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancelar
        </button>
        {!id && (
          <p className="self-center text-xs text-muted-foreground">
            Matrícula <span className="tabular font-medium">{matricula}</span>
          </p>
        )}
      </div>
    </form>
  )
}
