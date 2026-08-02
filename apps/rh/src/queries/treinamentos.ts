import { prisma } from '@/lib/prisma'
import { STATUS } from '@/lib/dominio/constantes'

export type FiltrosTurma = {
  busca?: string
  norma?: string
}

export async function listarTurmas(filtros: FiltrosTurma = {}) {
  const { busca, norma } = filtros
  const termo = busca?.trim()

  return prisma.treinamento.findMany({
    where: {
      ...(norma ? { norma } : {}),
      ...(termo ? { descricao: { contains: termo } } : {}),
    },
    orderBy: { realizadoEm: 'desc' },
    include: {
      _count: { select: { participantes: true } },
    },
  })
}

export type TurmaListada = Awaited<ReturnType<typeof listarTurmas>>[number]

export async function obterTurma(id: string) {
  return prisma.treinamento.findUnique({
    where: { id },
    include: {
      participantes: {
        orderBy: { funcionario: { nome: 'asc' } },
        include: { funcionario: { select: { id: true, nome: true, matricula: true } } },
      },
    },
  })
}

export type TurmaDetalhe = NonNullable<Awaited<ReturnType<typeof obterTurma>>>

/** Quem pode ser matriculado numa turma nova — desligado fica de fora. */
export async function funcionariosParaSelecao() {
  return prisma.funcionario.findMany({
    where: { status: { not: STATUS.DESLIGADO } },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, matricula: true },
  })
}

export type FuncionarioParaSelecao = Awaited<ReturnType<typeof funcionariosParaSelecao>>[number]

/**
 * Participações com validade vencida ou vencendo nos próximos `dias`.
 *
 * Turma sem `validadeEm` nunca aparece aqui — não é uma pendência, é uma turma que
 * simplesmente não expira (ex.: integração).
 */
export async function listarAlertasVencimento(dias = 30) {
  const hoje = new Date()
  const limite = new Date(hoje.getTime() + dias * 86_400_000)

  return prisma.treinamentoParticipante.findMany({
    where: { treinamento: { validadeEm: { lte: limite, not: null } } },
    orderBy: { treinamento: { validadeEm: 'asc' } },
    include: {
      funcionario: { select: { id: true, nome: true, matricula: true } },
      treinamento: { select: { id: true, descricao: true, norma: true, validadeEm: true } },
    },
  })
}

export type AlertaVencimento = Awaited<ReturnType<typeof listarAlertasVencimento>>[number]

export async function contarAlertas(dias = 30) {
  const alertas = await listarAlertasVencimento(dias)
  const hoje = new Date()
  const vencidos = alertas.filter((a) => a.treinamento.validadeEm && a.treinamento.validadeEm < hoje).length
  return { vencidos, vencendo: alertas.length - vencidos }
}
