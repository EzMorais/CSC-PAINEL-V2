import { prisma } from '@/lib/prisma'
import { STATUS_ALOCACAO, STATUS_PEDIDO } from '@/lib/dominio/constantes'

/** Meia-noite UTC de hoje — a mesma convenção com que as datas de calendário são gravadas. */
export function hojeUtc(): Date {
  const agora = new Date()
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()))
}

export async function indicadores() {
  const [alojamentos, ocupados, pedidosAbertos, programacoesHoje, rotas] = await Promise.all([
    prisma.alojamento.findMany({
      where: { ativo: true },
      select: { capacidadeTotal: true, quartos: { where: { ativo: true }, select: { capacidade: true } } },
    }),
    prisma.alocacao.count({ where: { status: STATUS_ALOCACAO.ATIVA } }),
    prisma.pedido.count({
      where: { status: { in: [STATUS_PEDIDO.ABERTO, STATUS_PEDIDO.EM_ANDAMENTO] } },
    }),
    prisma.programacao.count({ where: { data: hojeUtc() } }),
    prisma.rotaOnibus.count({ where: { ativo: true } }),
  ])

  const capacidade = alojamentos.reduce(
    (s, a) => s + (a.quartos.length > 0 ? a.quartos.reduce((q, x) => q + x.capacidade, 0) : a.capacidadeTotal ?? 0),
    0,
  )

  return {
    totalAlojamentos: alojamentos.length,
    capacidade,
    ocupados,
    vagas: Math.max(0, capacidade - ocupados),
    pedidosAbertos,
    programacoesHoje,
    rotas,
  }
}

export async function pedidosRecentes(limite = 6) {
  return prisma.pedido.findMany({
    orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }],
    take: limite,
    include: { alojamento: { select: { nome: true } } },
  })
}

export async function programacaoDoDia(data: Date) {
  return prisma.programacao.findMany({
    where: { data },
    orderBy: [{ horario: 'asc' }, { criadoEm: 'asc' }],
    include: { alojamento: { select: { nome: true } } },
  })
}
