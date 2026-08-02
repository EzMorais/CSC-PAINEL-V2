import { prisma } from '@/lib/prisma'
import { SINAL_MOVIMENTACAO, situacaoDoSaldo, type SituacaoSaldo, type TipoMovimentacao } from '@/lib/dominio/constantes'

/**
 * Saldo de cada material, somado a partir das movimentações.
 *
 * Uma consulta só para todos os materiais, e não uma por material: com N materiais na
 * tela, somar de dentro de um laço faria N+1 consultas e o tempo cresceria junto com o
 * cadastro. `groupBy` traz tudo de uma vez e a soma acontece em memória, sobre um
 * conjunto que é sempre pequeno (uma linha por material e tipo).
 *
 * A soma é feita aqui, e não em SQL com CASE, porque o sinal de cada tipo mora em
 * `SINAL_MOVIMENTACAO` — deixar a regra em um lugar só significa que acrescentar um tipo
 * novo de movimentação não exige lembrar de atualizar uma segunda cópia dela dentro de
 * uma query.
 */
export async function saldoPorMaterial(): Promise<Map<string, number>> {
  const grupos = await prisma.movimentacao.groupBy({
    by: ['materialId', 'tipo'],
    _sum: { quantidade: true },
  })

  const saldos = new Map<string, number>()
  for (const g of grupos) {
    const sinal = SINAL_MOVIMENTACAO[g.tipo as TipoMovimentacao] ?? 0
    const quantidade = g._sum.quantidade ?? 0
    saldos.set(g.materialId, (saldos.get(g.materialId) ?? 0) + sinal * quantidade)
  }
  return saldos
}

/** Saldo de um material só — para a tela de detalhe, onde carregar todos seria desperdício. */
export async function saldoDoMaterial(materialId: string): Promise<number> {
  const grupos = await prisma.movimentacao.groupBy({
    by: ['tipo'],
    where: { materialId },
    _sum: { quantidade: true },
  })

  return grupos.reduce((total, g) => {
    const sinal = SINAL_MOVIMENTACAO[g.tipo as TipoMovimentacao] ?? 0
    return total + sinal * (g._sum.quantidade ?? 0)
  }, 0)
}

/**
 * Último preço pago por unidade de cada material.
 *
 * É custo de REPOSIÇÃO, não custo contábil: responde "quanto custaria repor o que tenho",
 * que é a pergunta de quem compra. Não serve para balanço — para isso seria preciso custo
 * médio ponderado, que exige decidir o que fazer com devolução e ajuste, e essa decisão é
 * do contador, não do almoxarife.
 */
export async function ultimoPrecoPorMaterial(): Promise<Map<string, number>> {
  const entradas = await prisma.movimentacao.findMany({
    where: { tipo: 'ENTRADA', valorUnitario: { not: null } },
    orderBy: { ocorridoEm: 'desc' },
    select: { materialId: true, valorUnitario: true },
  })

  const precos = new Map<string, number>()
  for (const e of entradas) {
    // Já vem ordenado do mais recente para o mais antigo: o primeiro que aparece de cada
    // material é o último preço pago.
    if (!precos.has(e.materialId) && e.valorUnitario != null) {
      precos.set(e.materialId, e.valorUnitario)
    }
  }
  return precos
}

export type MaterialComSaldo = {
  id: string
  codigo: string
  nome: string
  categoria: string
  unidade: string
  estoqueMinimo: number
  localizacao: string | null
  ativo: boolean
  saldo: number
  situacao: SituacaoSaldo
  ultimoPreco: number | null
  valorEmEstoque: number | null
}

export type FiltrosMaterial = {
  busca?: string
  categoria?: string
  situacao?: string
}

/** A lista de materiais já com saldo, situação e valor — o que praticamente toda tela precisa. */
export async function listarMateriaisComSaldo(filtros: FiltrosMaterial = {}): Promise<MaterialComSaldo[]> {
  const { busca, categoria, situacao } = filtros
  const termo = busca?.trim()

  const [materiais, saldos, precos] = await Promise.all([
    prisma.material.findMany({
      where: {
        ...(categoria ? { categoria } : {}),
        ...(termo
          ? { OR: [{ nome: { contains: termo } }, { codigo: { contains: termo } }] }
          : {}),
      },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    }),
    saldoPorMaterial(),
    ultimoPrecoPorMaterial(),
  ])

  const linhas = materiais.map((m) => {
    const saldo = saldos.get(m.id) ?? 0
    const ultimoPreco = precos.get(m.id) ?? null
    return {
      id: m.id,
      codigo: m.codigo,
      nome: m.nome,
      categoria: m.categoria,
      unidade: m.unidade,
      estoqueMinimo: m.estoqueMinimo,
      localizacao: m.localizacao,
      ativo: m.ativo,
      saldo,
      situacao: situacaoDoSaldo(saldo, m.estoqueMinimo),
      ultimoPreco,
      valorEmEstoque: ultimoPreco != null ? saldo * ultimoPreco : null,
    }
  })

  // O filtro de situação é aplicado depois da consulta porque situação é derivada do
  // saldo, que por sua vez é derivado das movimentações — não existe coluna no banco para
  // o SQL filtrar.
  return situacao ? linhas.filter((l) => l.situacao === situacao) : linhas
}
