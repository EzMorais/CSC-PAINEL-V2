import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirSessao } from '@/lib/auth'
import { podeLancar } from '@/lib/dominio/cargos'
import { prisma } from '@/lib/prisma'
import { ListaFuncionarios } from '@/components/funcionarios/lista-funcionarios'

export const metadata = { title: 'Funcionários — Programação' }
export const dynamic = 'force-dynamic'

export default async function FuncionariosPage() {
  const sessao = await exigirSessao()

  const [funcionarios, funcoes] = await Promise.all([
    prisma.funcionario.findMany({
      orderBy: { nome: 'asc' },
      include: { _count: { select: { escalas: true } } },
    }),
    prisma.funcao.findMany({ where: { ativa: true }, orderBy: { ordem: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="flex items-start gap-3">
        <Link href="/" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Funcionários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro fixo de quem não está no RH — a maioria de quem é escalado todo dia
          </p>
        </div>
      </header>

      <ListaFuncionarios
        podeEditar={podeLancar(sessao.cargo)}
        funcoes={funcoes.map((f) => ({ sigla: f.sigla, nome: f.nome, cor: f.cor }))}
        funcionarios={funcionarios.map((f) => ({
          id: f.id, nome: f.nome, funcaoSigla: f.funcaoSigla, foto: f.foto,
          ativo: f.ativo, ausente: f.ausente, ausenteObs: f.ausenteObs,
          motorista: f.motorista, tipo: f.tipo, usos: f._count.escalas,
        }))}
      />
    </div>
  )
}
