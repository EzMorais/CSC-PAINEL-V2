import { prisma } from '@/lib/prisma'

export type FiltrosAuditoria = { busca?: string }

export async function listarAuditorias(filtros: FiltrosAuditoria = {}) {
  const termo = filtros.busca?.trim()
  return prisma.auditoria.findMany({
    where: termo ? { titulo: { contains: termo } } : {},
    orderBy: { realizadaEm: 'desc' },
    include: { obra: { select: { codigo: true } }, _count: { select: { itens: true } } },
  })
}

export type AuditoriaListada = Awaited<ReturnType<typeof listarAuditorias>>[number]

export async function obterAuditoria(id: string) {
  return prisma.auditoria.findUnique({
    where: { id },
    include: {
      obra: { select: { codigo: true, descricao: true } },
      itens: { orderBy: { criadoEm: 'asc' }, include: { naoConformidade: { select: { id: true } } } },
    },
  })
}

export type AuditoriaDetalhe = NonNullable<Awaited<ReturnType<typeof obterAuditoria>>>

export async function obrasParaSelecao() {
  return prisma.obra.findMany({
    where: { ativa: true },
    orderBy: { codigo: 'asc' },
    select: { id: true, codigo: true, descricao: true },
  })
}

export type ObraParaSelecao = Awaited<ReturnType<typeof obrasParaSelecao>>[number]
