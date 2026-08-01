import { prisma } from '@/lib/prisma'
import { DIAS_ATENCAO, ESTADO } from '@/lib/dominio/constantes'
import { limiteEmDias } from '@/lib/dominio/status'
import { valorTotal } from '@/lib/dominio/periodo'

export type IndicadoresDashboard = {
  valorEmLocacao: number
  ativos: number
  vencemEm7Dias: number
  vencidos: number
  perdidos: number
  perdidosEmAberto: number
  aConfirmar: number
}

const naoDevolvida = { devolvidaEm: null } as const

export async function obterIndicadores(hoje = new Date()): Promise<IndicadoresDashboard> {
  // `limiteEmDias`, e não `startOfDay`: `dataFim` está gravada como meia-noite UTC
  // representando um dia de calendário, então o filtro precisa comparar no mesmo
  // referencial. Com `startOfDay` local o SQL discordaria da etiqueta da tela.
  const inicioHoje = limiteEmDias(0, hoje)
  const limite7 = limiteEmDias(DIAS_ATENCAO, hoje)

  const [
    locacoes,
    ativos,
    vencemEm7Dias,
    vencidos,
    perdidos,
    perdidosEmAberto,
    aConfirmar,
  ] = await Promise.all([
    prisma.locacao.findMany({
      where: naoDevolvida,
      select: { valorItem: true, dataInicio: true, dataFim: true },
    }),
    prisma.locacao.count({ where: naoDevolvida }),
    prisma.locacao.count({ where: { ...naoDevolvida, dataFim: { gte: inicioHoje, lte: limite7 } } }),
    prisma.locacao.count({ where: { ...naoDevolvida, dataFim: { lt: inicioHoje } } }),
    // Único contador que ignora `devolvidaEm`: item perdido é prejuízo já
    // incorrido, não pendência em aberto. Filtrar por não-devolvida sumiria
    // justamente com os que já custaram dinheiro (a locação foi encerrada
    // porque o equipamento foi pago ao locador).
    prisma.locacao.count({ where: { estado: ESTADO.PERDIDO } }),
    prisma.locacao.count({ where: { ...naoDevolvida, estado: ESTADO.PERDIDO } }),
    prisma.locacao.count({ where: { ...naoDevolvida, obraAConfirmar: true } }),
  ])

  const valorEmLocacao = locacoes.reduce(
    (soma, l) => soma + valorTotal(l.valorItem, l.dataInicio, l.dataFim),
    0
  )

  return {
    valorEmLocacao,
    ativos,
    vencemEm7Dias,
    vencidos,
    perdidos,
    perdidosEmAberto,
    aConfirmar,
  }
}

export type FatiaGrafico = { nome: string; valor: number; quantidade: number }

export async function obterPorFornecedor(): Promise<FatiaGrafico[]> {
  const locacoes = await prisma.locacao.findMany({
    where: naoDevolvida,
    select: {
      valorItem: true, dataInicio: true, dataFim: true,
      fornecedor: { select: { nome: true } },
    },
  })

  const agregado = new Map<string, { valor: number; quantidade: number }>()
  for (const l of locacoes) {
    const nome = l.fornecedor?.nome ?? 'Sem fornecedor'
    const atual = agregado.get(nome) ?? { valor: 0, quantidade: 0 }
    atual.valor += valorTotal(l.valorItem, l.dataInicio, l.dataFim)
    atual.quantidade += 1
    agregado.set(nome, atual)
  }

  return [...agregado]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.valor - a.valor)
}

export async function obterPorObra(): Promise<FatiaGrafico[]> {
  const locacoes = await prisma.locacao.findMany({
    where: naoDevolvida,
    select: {
      valorItem: true, dataInicio: true, dataFim: true,
      obra: { select: { codigo: true, cliente: true } },
    },
  })

  const agregado = new Map<string, { valor: number; quantidade: number }>()
  for (const l of locacoes) {
    const nome = `${l.obra.cliente} · ${l.obra.codigo}`
    const atual = agregado.get(nome) ?? { valor: 0, quantidade: 0 }
    atual.valor += valorTotal(l.valorItem, l.dataInicio, l.dataFim)
    atual.quantidade += 1
    agregado.set(nome, atual)
  }

  return [...agregado]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.valor - a.valor)
}

/**
 * `lte` sem piso inferior é de propósito: vencidos aparecem junto dos que estão
 * por vencer, porque quem abre o painel de manhã precisa ver os dois na mesma lista.
 */
export async function obterVencimentosProximos(hoje = new Date()) {
  return prisma.locacao.findMany({
    where: { ...naoDevolvida, dataFim: { lte: limiteEmDias(DIAS_ATENCAO, hoje) } },
    orderBy: { dataFim: 'asc' },
    take: 25,
    select: {
      id: true, descricao: true, trCodigo: true, dataFim: true, valorItem: true,
      obra: { select: { codigo: true, cliente: true } },
      fornecedor: { select: { nome: true } },
    },
  })
}
