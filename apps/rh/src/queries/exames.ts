import { prisma } from '@/lib/prisma'
import { STATUS } from '@/lib/dominio/constantes'

export type FiltrosExame = {
  busca?: string
  tipo?: string
}

export async function listarExames(filtros: FiltrosExame = {}) {
  const { busca, tipo } = filtros
  const termo = busca?.trim()

  return prisma.exame.findMany({
    where: {
      ...(tipo ? { tipo } : {}),
      ...(termo
        ? {
            OR: [
              { funcionario: { nome: { contains: termo } } },
              { funcionario: { matricula: { contains: termo } } },
            ],
          }
        : {}),
    },
    orderBy: [{ realizadoEm: 'desc' }],
    include: { funcionario: { select: { nome: true, matricula: true } } },
  })
}

export type ExameListado = Awaited<ReturnType<typeof listarExames>>[number]

export async function funcionariosParaExame() {
  return prisma.funcionario.findMany({
    where: { status: { not: STATUS.DESLIGADO } },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, matricula: true },
  })
}

export type FuncionarioParaExame = Awaited<ReturnType<typeof funcionariosParaExame>>[number]

/** Exames com validade vencida ou vencendo nos próximos `dias`. Sem validade nunca entra aqui — não é pendência. */
export async function listarAlertasExame(dias = 30) {
  const hoje = new Date()
  const limite = new Date(hoje.getTime() + dias * 86_400_000)

  return prisma.exame.findMany({
    where: { validadeEm: { lte: limite, not: null } },
    orderBy: { validadeEm: 'asc' },
    include: { funcionario: { select: { id: true, nome: true, matricula: true } } },
  })
}

export type AlertaExame = Awaited<ReturnType<typeof listarAlertasExame>>[number]

export async function contarAlertasExame(dias = 30) {
  const alertas = await listarAlertasExame(dias)
  const hoje = new Date()
  const vencidos = alertas.filter((a) => a.validadeEm && a.validadeEm < hoje).length
  return { vencidos, vencendo: alertas.length - vencidos }
}
