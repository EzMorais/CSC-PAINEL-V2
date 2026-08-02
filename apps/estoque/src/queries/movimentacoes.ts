import { prisma } from '@/lib/prisma'

export type FiltrosMovimentacao = {
  busca?: string
  tipo?: string
  obraId?: string
}

export async function listarMovimentacoes(filtros: FiltrosMovimentacao = {}, limite = 200) {
  const { busca, tipo, obraId } = filtros
  const termo = busca?.trim()

  return prisma.movimentacao.findMany({
    where: {
      ...(tipo ? { tipo } : {}),
      ...(obraId ? { obraId } : {}),
      ...(termo
        ? {
            OR: [
              { material: { nome: { contains: termo } } },
              { material: { codigo: { contains: termo } } },
              { documento: { contains: termo } },
            ],
          }
        : {}),
    },
    orderBy: [{ ocorridoEm: 'desc' }, { registradoEm: 'desc' }],
    take: limite,
    include: {
      material: { select: { codigo: true, nome: true, unidade: true } },
      obra: { select: { codigo: true } },
      fornecedor: { select: { nome: true } },
    },
  })
}

export type MovimentacaoListada = Awaited<ReturnType<typeof listarMovimentacoes>>[number]

export async function listarObras() {
  return prisma.obra.findMany({
    orderBy: { codigo: 'asc' },
    select: { id: true, codigo: true, cliente: true, descricao: true, responsavel: true, ativa: true },
  })
}

export type ObraListada = Awaited<ReturnType<typeof listarObras>>[number]

export async function listarFornecedores() {
  return prisma.fornecedor.findMany({ orderBy: { nome: 'asc' } })
}

export type FornecedorListado = Awaited<ReturnType<typeof listarFornecedores>>[number]
