import { prisma } from '@/lib/prisma'
import { STATUS_NC } from '@/lib/dominio/constantes'

export type FiltrosNc = { busca?: string; status?: string; gravidade?: string }

export async function listarNaoConformidades(filtros: FiltrosNc = {}) {
  const { busca, status, gravidade } = filtros
  const termo = busca?.trim()

  return prisma.naoConformidade.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(gravidade ? { gravidade } : {}),
      ...(termo ? { titulo: { contains: termo } } : {}),
    },
    orderBy: [{ status: 'asc' }, { prazo: 'asc' }],
    include: { auditoriaItem: { include: { auditoria: { select: { id: true, titulo: true } } } } },
  })
}

export type NaoConformidadeListada = Awaited<ReturnType<typeof listarNaoConformidades>>[number]

export async function contarNaoConformidadesAbertas() {
  return prisma.naoConformidade.count({ where: { status: { not: STATUS_NC.RESOLVIDA } } })
}

export async function contarNaoConformidadesVencidas() {
  return prisma.naoConformidade.count({
    where: { status: { not: STATUS_NC.RESOLVIDA }, prazo: { lt: new Date() } },
  })
}
