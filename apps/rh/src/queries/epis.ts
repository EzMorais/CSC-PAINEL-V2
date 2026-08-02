import { prisma } from '@/lib/prisma'
import { STATUS } from '@/lib/dominio/constantes'

export type FiltrosEpi = { busca?: string }

export async function listarEntregasEpi(filtros: FiltrosEpi = {}) {
  const termo = filtros.busca?.trim()

  return prisma.entregaEpi.findMany({
    where: termo
      ? {
          OR: [
            { funcionario: { nome: { contains: termo } } },
            { funcionario: { matricula: { contains: termo } } },
            { materialNome: { contains: termo } },
            { ca: { contains: termo } },
          ],
        }
      : {},
    orderBy: [{ entregueEm: 'desc' }, { recebidoEm: 'desc' }],
    include: { funcionario: { select: { id: true, nome: true, matricula: true } } },
  })
}

export type EntregaEpiListada = Awaited<ReturnType<typeof listarEntregasEpi>>[number]

export async function indicadoresEpi() {
  const hoje = new Date()
  const inicioDoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))

  const [total, doMes, comCaVencido, ativos, funcionariosComEpi] = await Promise.all([
    prisma.entregaEpi.count(),
    prisma.entregaEpi.count({ where: { entregueEm: { gte: inicioDoMes } } }),
    // CA vencido é do equipamento, não da entrega: a empresa entregou um EPI cujo
    // certificado já não vale, e isso precisa aparecer mesmo depois da entrega feita.
    prisma.entregaEpi.count({ where: { validadeCA: { lt: hoje, not: null } } }),
    prisma.funcionario.count({ where: { status: { not: STATUS.DESLIGADO } } }),
    prisma.entregaEpi.findMany({ distinct: ['funcionarioId'], select: { funcionarioId: true } }),
  ])

  return {
    total,
    doMes,
    comCaVencido,
    semNenhumEpi: ativos - funcionariosComEpi.length,
  }
}

/** Quem está na ativa e nunca recebeu EPI nenhum — a pendência que o SST cobra. */
export async function funcionariosSemEpi() {
  return prisma.funcionario.findMany({
    where: { status: { not: STATUS.DESLIGADO }, entregasEpi: { none: {} } },
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      matricula: true,
      cargo: { select: { nome: true, risco: true } },
      obra: { select: { codigo: true } },
    },
  })
}

export type FuncionarioSemEpi = Awaited<ReturnType<typeof funcionariosSemEpi>>[number]
