import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { FormFuncionario } from '@/components/funcionarios/form-funcionario'
import { Timeline } from '@/components/funcionarios/timeline'
import { obterFuncionario, opcoes } from '@/queries/funcionarios'
import { formatarCpf } from '@/lib/dominio/cpf'
import { ROTULO_STATUS, type Status } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const f = await obterFuncionario(id)
  return { title: f ? `${f.nome} — RH e SST` : 'Funcionário — RH e SST' }
}

/** Data do banco para o `value` de um <input type="date">, sem sair do referencial UTC. */
function paraCampoData(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export default async function FuncionarioPage({ params }: Props) {
  const { id } = await params
  const [funcionario, listas] = await Promise.all([obterFuncionario(id), opcoes()])
  if (!funcionario) notFound()

  const valores: Record<string, string> = {
    nome: funcionario.nome,
    cpf: funcionario.cpf,
    rg: funcionario.rg ?? '',
    dataNascimento: paraCampoData(funcionario.dataNascimento),
    sexo: funcionario.sexo ?? '',
    estadoCivil: funcionario.estadoCivil ?? '',
    nomeMae: funcionario.nomeMae ?? '',
    foto: funcionario.foto ?? '',
    telefone: funcionario.telefone ?? '',
    email: funcionario.email ?? '',
    cep: funcionario.cep ?? '',
    logradouro: funcionario.logradouro ?? '',
    numero: funcionario.numero ?? '',
    complemento: funcionario.complemento ?? '',
    bairro: funcionario.bairro ?? '',
    cidade: funcionario.cidade ?? '',
    uf: funcionario.uf ?? '',
    admitidoEm: paraCampoData(funcionario.admitidoEm),
    status: funcionario.status,
    tipoContrato: funcionario.tipoContrato,
    obraId: funcionario.obraId ?? '',
    cargoId: funcionario.cargoId ?? '',
    departamentoId: funcionario.departamentoId ?? '',
    nivelObra: funcionario.nivelObra ?? '',
    salario: funcionario.salario != null ? String(funcionario.salario) : '',
    banco: funcionario.banco ?? '',
    agencia: funcionario.agencia ?? '',
    conta: funcionario.conta ?? '',
    tipoConta: funcionario.tipoConta ?? '',
    chavePix: funcionario.chavePix ?? '',
    tamanhoCamisa: funcionario.tamanhoCamisa ?? '',
    tamanhoCalca: funcionario.tamanhoCalca ?? '',
    tamanhoCalcado: funcionario.tamanhoCalcado ?? '',
    observacoes: funcionario.observacoes ?? '',
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/funcionarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Funcionários
        </Link>
        <h1 className="mt-2 text-2xl font-semibold" data-testid="nome-funcionario">{funcionario.nome}</h1>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="tabular">{funcionario.matricula}</span>
          <span className="tabular">{formatarCpf(funcionario.cpf)}</span>
          <span>{ROTULO_STATUS[funcionario.status as Status] ?? funcionario.status}</span>
          <span>Admitido em {dataBR(funcionario.admitidoEm)}</span>
          {funcionario.obra && <span>{funcionario.obra.codigo}</span>}
          {funcionario.cargo && <span>{funcionario.cargo.nome}</span>}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Cadastro">
          <FormFuncionario
            id={funcionario.id}
            matricula={funcionario.matricula}
            valores={valores}
            opcoes={listas}
          />
        </section>

        <aside className="rounded-lg border border-border bg-card p-4">
          <Timeline
            funcionarioId={funcionario.id}
            itens={funcionario.eventos.map((e) => ({
              id: e.id,
              tipo: e.tipo,
              descricaoHumana: e.descricaoHumana,
              detalhe: e.detalhe,
              ocorridoEm: e.ocorridoEm,
              registradoPor: e.registradoPor,
            }))}
          />
        </aside>
      </div>
    </div>
  )
}
