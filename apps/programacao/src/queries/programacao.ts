import { prisma } from '@/lib/prisma'
import { diaUtc } from '@/lib/dominio/constantes'

export async function frentesAtivas() {
  return prisma.frente.findMany({ where: { ativa: true }, orderBy: { ordem: 'asc' } })
}

export type FrenteListada = Awaited<ReturnType<typeof frentesAtivas>>[number]

export async function funcoesAtivas() {
  return prisma.funcao.findMany({ where: { ativa: true }, orderBy: { ordem: 'asc' } })
}

export type FuncaoListada = Awaited<ReturnType<typeof funcoesAtivas>>[number]

/**
 * A programação de um dia, com tudo que a tela precisa.
 *
 * Devolve null quando o dia ainda não existe — a tela oferece criar, em vez de criar
 * sozinha ao abrir. Criar por consulta encheria o banco de dias vazios só porque alguém
 * navegou pelo calendário.
 */
export async function programacaoDoDia(data: Date) {
  return prisma.programacao.findUnique({
    where: { data: diaUtc(data) },
    include: {
      escalas: { orderBy: [{ frenteId: 'asc' }, { ordem: 'asc' }] },
      recursos: { orderBy: [{ frenteId: 'asc' }, { ordem: 'asc' }] },
    },
  })
}

export type ProgramacaoCompleta = NonNullable<Awaited<ReturnType<typeof programacaoDoDia>>>

/** O dia anterior que TEM programação — é dele que o "copiar" parte. */
export async function ultimaProgramacaoAntesDe(data: Date) {
  return prisma.programacao.findFirst({
    where: { data: { lt: diaUtc(data) } },
    orderBy: { data: 'desc' },
    include: { escalas: true, recursos: true },
  })
}

/** Os dias já montados, para a navegação lateral. */
export async function diasRecentes(limite = 14) {
  return prisma.programacao.findMany({
    orderBy: { data: 'desc' },
    take: limite,
    select: {
      id: true, data: true, status: true,
      _count: { select: { escalas: true } },
    },
  })
}

export type DiaListado = Awaited<ReturnType<typeof diasRecentes>>[number]
