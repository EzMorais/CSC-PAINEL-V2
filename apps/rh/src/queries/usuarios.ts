import { prisma } from '@/lib/prisma'

export async function listarUsuarios() {
  return prisma.usuario.findMany({
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
  })
}

export type UsuarioListado = Awaited<ReturnType<typeof listarUsuarios>>[number]
