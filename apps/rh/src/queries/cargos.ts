import { prisma } from '@/lib/prisma'

/** Todos os cargos, ativos ou não — a listagem de Configurações precisa ver os dois. */
export async function listarCargos() {
  return prisma.cargo.findMany({ orderBy: { nome: 'asc' } })
}

export type CargoListado = Awaited<ReturnType<typeof listarCargos>>[number]
