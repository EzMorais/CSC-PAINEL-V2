import { prisma } from '@/lib/prisma'
import { TIPOS_EM_ORDEM, type TipoCadastro } from '@/lib/dominio/cadastros'

export async function listarPorTipo(tipo: TipoCadastro) {
  return prisma.itemCadastro.findMany({
    where: { tipo },
    // Inativos no fim, e não escondidos: o item desativado precisa continuar achável para
    // ser reativado, e sumir daria a entender que ele foi apagado.
    orderBy: [{ ativo: 'desc' }, { codigo: 'asc' }],
  })
}

export type ItemListado = Awaited<ReturnType<typeof listarPorTipo>>[number]

/** Quantos itens ativos há em cada tipo — o número que aparece na aba. */
export async function contagemPorTipo(): Promise<Record<TipoCadastro, number>> {
  const grupos = await prisma.itemCadastro.groupBy({
    by: ['tipo'],
    where: { ativo: true },
    _count: { _all: true },
  })

  const mapa = new Map(grupos.map((g) => [g.tipo, g._count._all]))
  return Object.fromEntries(
    TIPOS_EM_ORDEM.map((t) => [t, mapa.get(t) ?? 0]),
  ) as Record<TipoCadastro, number>
}
