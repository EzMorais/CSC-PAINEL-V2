import { prisma } from '@/lib/prisma'
import { STATUS } from '@/lib/dominio/constantes'

/**
 * Início do mês corrente em UTC.
 *
 * UTC e não local pela mesma razão do Painel de Locação: um limiar em meia-noite local
 * cai 3 horas depois no Brasil, e o filtro passa a discordar da data exibida ao lado.
 * As datas são gravadas como meia-noite UTC representando um dia de calendário.
 */
function inicioDoMes(): Date {
  const agora = new Date()
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
}

export type IndicadoresRh = {
  ativos: number
  afastados: number
  ferias: number
  desligados: number
  admissoesDoMes: number
  desligamentosDoMes: number
  semObra: number
  semCargo: number
  totalObras: number
}

export async function indicadores(): Promise<IndicadoresRh> {
  const desdeInicioDoMes = inicioDoMes()

  const [
    ativos, afastados, ferias, desligados,
    admissoesDoMes, desligamentosDoMes,
    semObra, semCargo, totalObras,
  ] = await Promise.all([
    prisma.funcionario.count({ where: { status: STATUS.ATIVO } }),
    prisma.funcionario.count({ where: { status: STATUS.AFASTADO } }),
    prisma.funcionario.count({ where: { status: STATUS.FERIAS } }),
    prisma.funcionario.count({ where: { status: STATUS.DESLIGADO } }),
    prisma.funcionario.count({ where: { admitidoEm: { gte: desdeInicioDoMes } } }),
    prisma.funcionario.count({ where: { demitidoEm: { gte: desdeInicioDoMes } } }),
    // Só entre quem está na ativa: cobrar obra de quem já saiu seria ruído permanente.
    prisma.funcionario.count({ where: { obraId: null, status: { not: STATUS.DESLIGADO } } }),
    prisma.funcionario.count({ where: { cargoId: null, status: { not: STATUS.DESLIGADO } } }),
    prisma.obra.count({ where: { ativa: true } }),
  ])

  return {
    ativos, afastados, ferias, desligados,
    admissoesDoMes, desligamentosDoMes,
    semObra, semCargo, totalObras,
  }
}

export type LinhaPorObra = { obra: string; codigo: string; total: number; pendencias: number }

/** Quantos estão em cada obra, e quantos deles ainda têm cadastro incompleto. */
export async function porObra(): Promise<LinhaPorObra[]> {
  const obras = await prisma.obra.findMany({
    where: { ativa: true },
    orderBy: { codigo: 'asc' },
    include: {
      funcionarios: {
        where: { status: { not: STATUS.DESLIGADO } },
        select: { cargoId: true, cpf: true, admitidoEm: true },
      },
    },
  })

  return obras.map((o) => ({
    obra: o.descricao,
    codigo: o.codigo,
    total: o.funcionarios.length,
    pendencias: o.funcionarios.filter((f) => !f.cargoId).length,
  }))
}

export type EventoRecente = {
  id: string
  tipo: string
  descricaoHumana: string
  ocorridoEm: Date
  funcionario: string
  funcionarioId: string
}

export async function eventosRecentes(limite = 8): Promise<EventoRecente[]> {
  const eventos = await prisma.evento.findMany({
    orderBy: { ocorridoEm: 'desc' },
    take: limite,
    include: { funcionario: { select: { id: true, nome: true } } },
  })

  return eventos.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    descricaoHumana: e.descricaoHumana,
    ocorridoEm: e.ocorridoEm,
    funcionario: e.funcionario.nome,
    funcionarioId: e.funcionario.id,
  }))
}

/** Admissões por mês nos últimos N meses — alimenta o gráfico do dashboard. */
export async function admissoesPorMes(meses = 6): Promise<Array<{ mes: string; total: number }>> {
  const agora = new Date()
  const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (meses - 1), 1))

  const funcionarios = await prisma.funcionario.findMany({
    where: { admitidoEm: { gte: inicio } },
    select: { admitidoEm: true },
  })

  // Monta os buckets antes de contar: um mês sem admissão precisa aparecer com 0,
  // senão o gráfico "pula" o mês e sugere que o período foi mais curto do que foi.
  const baldes = new Map<string, number>()
  for (let i = 0; i < meses; i++) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (meses - 1 - i), 1))
    baldes.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, 0)
  }

  for (const f of funcionarios) {
    const d = f.admitidoEm
    const chave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    if (baldes.has(chave)) baldes.set(chave, (baldes.get(chave) ?? 0) + 1)
  }

  const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return [...baldes.entries()].map(([chave, total]) => {
    const mes = Number(chave.slice(5, 7)) - 1
    return { mes: NOMES[mes], total }
  })
}
