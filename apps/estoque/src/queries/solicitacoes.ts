import { prisma } from '@/lib/prisma'
import { listarMateriaisComSaldo } from './saldos'
import { SITUACAO_SALDO } from '@/lib/dominio/constantes'

export async function listarSolicitacoes() {
  return prisma.solicitacaoCompra.findMany({
    orderBy: { criadoEm: 'desc' },
    include: {
      itens: { include: { material: { select: { codigo: true, nome: true, unidade: true } } } },
    },
  })
}

export type SolicitacaoListada = Awaited<ReturnType<typeof listarSolicitacoes>>[number]

export async function obterSolicitacao(id: string) {
  return prisma.solicitacaoCompra.findUnique({
    where: { id },
    include: {
      itens: {
        orderBy: { material: { nome: 'asc' } },
        include: { material: { select: { id: true, codigo: true, nome: true, unidade: true } } },
      },
    },
  })
}

export type SolicitacaoDetalhe = NonNullable<Awaited<ReturnType<typeof obterSolicitacao>>>

/**
 * Próximo número livre, no formato SC-2026-0001.
 *
 * Lê o maior existente em vez de contar: contar daria colisão assim que uma solicitação
 * fosse excluída, e dois pedidos com o mesmo número é exatamente o tipo de coisa que
 * ninguém percebe até o fornecedor cobrar duas vezes.
 */
export async function proximoNumero(): Promise<string> {
  const ano = new Date().getUTCFullYear()
  const ultimo = await prisma.solicitacaoCompra.findFirst({
    where: { numero: { startsWith: `SC-${ano}-` } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })
  const sequencia = ultimo ? Number(ultimo.numero.split('-')[2]) + 1 : 1
  return `SC-${ano}-${String(sequencia).padStart(4, '0')}`
}

export type ItemSugerido = {
  materialId: string
  codigo: string
  nome: string
  unidade: string
  saldo: number
  estoqueMinimo: number
  quantidadeSugerida: number
  precoEstimado: number | null
}

/**
 * O que comprar, e quanto.
 *
 * A quantidade sugerida repõe até o DOBRO do mínimo, não até o mínimo exato. Comprar só o
 * que falta para bater o mínimo deixa o item de novo no limite no dia seguinte, e o
 * almoxarife volta a pedir a mesma coisa toda semana — o mínimo é o ponto onde se compra,
 * não o alvo da compra.
 *
 * É sugestão: a tela deixa editar tudo antes de gravar. Quem conhece o prazo do fornecedor
 * e o ritmo da obra é quem compra, não a fórmula.
 */
export async function sugerirItens(): Promise<ItemSugerido[]> {
  const materiais = await listarMateriaisComSaldo()

  return materiais
    .filter((m) => m.ativo && m.situacao !== SITUACAO_SALDO.OK)
    .map((m) => {
      // Sem mínimo cadastrado não há alvo: o item só entrou na lista por estar zerado, e
      // aí a sugestão é simbólica — 1 unidade, para quem monta o pedido corrigir.
      const alvo = m.estoqueMinimo > 0 ? m.estoqueMinimo * 2 : 1
      return {
        materialId: m.id,
        codigo: m.codigo,
        nome: m.nome,
        unidade: m.unidade,
        saldo: m.saldo,
        estoqueMinimo: m.estoqueMinimo,
        quantidadeSugerida: Math.max(1, Math.ceil(alvo - m.saldo)),
        precoEstimado: m.ultimoPreco,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function contarSolicitacoesAbertas() {
  return prisma.solicitacaoCompra.count({ where: { status: { in: ['RASCUNHO', 'ENVIADA'] } } })
}
