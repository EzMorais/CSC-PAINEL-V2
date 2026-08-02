import { prisma } from '@/lib/prisma'

export async function listarUsuarios() {
  return prisma.usuario.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: { acessos: { select: { modulo: true } } },
  })
}

export type UsuarioListado = Awaited<ReturnType<typeof listarUsuarios>>[number]

/** Últimas tentativas de acesso — quem entrou, quem errou a senha e quando. */
export async function ultimosAcessos(limite = 15) {
  return prisma.registroAcesso.findMany({ orderBy: { ocorrido: 'desc' }, take: limite })
}

export type AcessoListado = Awaited<ReturnType<typeof ultimosAcessos>>[number]
