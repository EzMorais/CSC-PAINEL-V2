import { prisma } from '@/lib/prisma'
import { listarMateriaisComSaldo } from './saldos'
import { SITUACAO_SALDO, SINAL_MOVIMENTACAO, MOVIMENTACAO, type TipoMovimentacao } from '@/lib/dominio/constantes'

/**
 * Início do mês corrente em UTC.
 *
 * UTC e não local pela mesma razão dos outros módulos: um limiar em meia-noite local cai 3
 * horas depois no Brasil, e o filtro passa a discordar da data exibida ao lado.
 */
function inicioDoMes(): Date {
  const agora = new Date()
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
}

export type IndicadoresEstoque = {
  totalMateriais: number
  semEstoque: number
  abaixoDoMinimo: number
  valorEmEstoque: number
  entradasDoMes: number
  saidasDoMes: number
  obrasAtivas: number
}

export async function indicadores(): Promise<IndicadoresEstoque> {
  const desdeInicioDoMes = inicioDoMes()

  const [materiais, movimentacoesDoMes, obrasAtivas] = await Promise.all([
    listarMateriaisComSaldo(),
    prisma.movimentacao.groupBy({
      by: ['tipo'],
      where: { ocorridoEm: { gte: desdeInicioDoMes } },
      _count: { _all: true },
    }),
    prisma.obra.count({ where: { ativa: true } }),
  ])

  const ativos = materiais.filter((m) => m.ativo)
  const contarPorTipo = (tipo: TipoMovimentacao) =>
    movimentacoesDoMes.find((m) => m.tipo === tipo)?._count._all ?? 0

  return {
    totalMateriais: ativos.length,
    semEstoque: ativos.filter((m) => m.situacao === SITUACAO_SALDO.ZERADO).length,
    abaixoDoMinimo: ativos.filter((m) => m.situacao === SITUACAO_SALDO.ABAIXO).length,
    // Só saldo positivo entra: um saldo negativo é erro de lançamento, e somá-lo como
    // valor negativo faria o total do almoxarifado "encolher" por causa de um engano de
    // digitação, escondendo o problema em vez de mostrá-lo.
    valorEmEstoque: ativos.reduce((s, m) => s + Math.max(0, m.valorEmEstoque ?? 0), 0),
    entradasDoMes: contarPorTipo(MOVIMENTACAO.ENTRADA),
    saidasDoMes: contarPorTipo(MOVIMENTACAO.SAIDA),
    obrasAtivas,
  }
}

/** Os materiais que precisam de compra — o que o almoxarife abre o sistema para ver. */
export async function materiaisParaRepor(limite = 10) {
  const materiais = await listarMateriaisComSaldo()
  return materiais
    .filter((m) => m.ativo && m.situacao !== SITUACAO_SALDO.OK)
    // Sem estoque antes de abaixo do mínimo, e dentro de cada grupo o mais crítico primeiro.
    .sort((a, b) => {
      if (a.situacao !== b.situacao) return a.situacao === SITUACAO_SALDO.ZERADO ? -1 : 1
      return a.saldo - b.saldo
    })
    .slice(0, limite)
}

export type MovimentacaoRecente = {
  id: string
  tipo: string
  quantidade: number
  ocorridoEm: Date
  material: string
  materialId: string
  unidade: string
  obra: string | null
}

export async function movimentacoesRecentes(limite = 8): Promise<MovimentacaoRecente[]> {
  const movimentacoes = await prisma.movimentacao.findMany({
    orderBy: [{ ocorridoEm: 'desc' }, { registradoEm: 'desc' }],
    take: limite,
    include: {
      material: { select: { id: true, nome: true, unidade: true } },
      obra: { select: { codigo: true } },
    },
  })

  return movimentacoes.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    quantidade: m.quantidade,
    ocorridoEm: m.ocorridoEm,
    material: m.material.nome,
    materialId: m.material.id,
    unidade: m.material.unidade,
    obra: m.obra?.codigo ?? null,
  }))
}

/** Consumo (saídas menos devoluções) por obra — para onde o material está indo. */
export async function consumoPorObra() {
  const obras = await prisma.obra.findMany({
    where: { ativa: true },
    orderBy: { codigo: 'asc' },
    include: {
      movimentacoes: {
        where: { tipo: { in: [MOVIMENTACAO.SAIDA, MOVIMENTACAO.DEVOLUCAO] } },
        select: { tipo: true, quantidade: true, valorUnitario: true, materialId: true },
      },
    },
  })

  // O valor do consumo usa o último preço de compra de cada material, pela mesma razão
  // explicada em `ultimoPrecoPorMaterial`: é custo de reposição, não custo contábil.
  const { ultimoPrecoPorMaterial } = await import('./saldos')
  const precos = await ultimoPrecoPorMaterial()

  return obras.map((o) => {
    let itens = 0
    let valor = 0
    for (const m of o.movimentacoes) {
      const sinal = SINAL_MOVIMENTACAO[m.tipo as TipoMovimentacao] ?? 0
      // Saída soma consumo, devolução desconta — por isso o sinal entra invertido: aqui a
      // pergunta é "quanto a obra levou", não "como o saldo do almoxarifado mudou".
      itens += -sinal * m.quantidade
      valor += -sinal * m.quantidade * (precos.get(m.materialId) ?? 0)
    }
    return { codigo: o.codigo, descricao: o.descricao, itens, valor }
  })
}

export type ConsumoObra = Awaited<ReturnType<typeof consumoPorObra>>[number]
