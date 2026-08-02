import { prisma } from '@/lib/prisma'
import { STATUS } from '@/lib/dominio/constantes'

export type FiltrosEntrega = {
  busca?: string
  peca?: string
}

export async function listarEntregas(filtros: FiltrosEntrega = {}) {
  const { busca, peca } = filtros
  const termo = busca?.trim()

  return prisma.entregaUniforme.findMany({
    where: {
      ...(peca ? { peca } : {}),
      ...(termo
        ? {
            OR: [
              { funcionario: { nome: { contains: termo } } },
              { funcionario: { matricula: { contains: termo } } },
            ],
          }
        : {}),
    },
    orderBy: [{ entregueEm: 'desc' }, { criadoEm: 'desc' }],
    include: {
      funcionario: { select: { nome: true, matricula: true } },
    },
  })
}

export type EntregaListada = Awaited<ReturnType<typeof listarEntregas>>[number]

/** Quem pode receber uniforme agora — desligado não entra na lista. */
export async function funcionariosParaEntrega() {
  return prisma.funcionario.findMany({
    where: { status: { not: STATUS.DESLIGADO } },
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      matricula: true,
      tamanhoCamisa: true,
      tamanhoCalca: true,
      tamanhoCalcado: true,
    },
  })
}

export type FuncionarioParaEntrega = Awaited<ReturnType<typeof funcionariosParaEntrega>>[number]

/** Ativos/afastados/férias que nunca receberam nenhuma peça — o mesmo tipo de pendência que o dashboard já mostra para obra e cargo. */
export async function contarSemEntrega(): Promise<number> {
  return prisma.funcionario.count({
    where: { status: { not: STATUS.DESLIGADO }, entregasUniforme: { none: {} } },
  })
}
