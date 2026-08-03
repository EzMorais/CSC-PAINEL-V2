import { prisma } from '@/lib/prisma'
import { STATUS_ALOCACAO } from '@/lib/dominio/constantes'

export type FiltrosMorador = { status?: string; alojamentoId?: string; busca?: string }

export async function listarAlocacoes(filtros: FiltrosMorador = {}) {
  const { status, alojamentoId, busca } = filtros
  const termo = busca?.trim()

  return prisma.alocacao.findMany({
    where: {
      ...(status && status !== 'TODAS' ? { status } : {}),
      ...(alojamentoId ? { alojamentoId } : {}),
      ...(termo
        ? { OR: [{ funcionarioNome: { contains: termo } }, { funcionarioMatricula: { contains: termo } }] }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { funcionarioNome: 'asc' }],
    include: {
      alojamento: { select: { id: true, nome: true, cidade: true } },
      quarto: { select: { numero: true } },
      rotaOnibus: { select: { nome: true } },
    },
  })
}

export type AlocacaoListada = Awaited<ReturnType<typeof listarAlocacoes>>[number]

/**
 * Ids de quem já mora em algum lugar.
 *
 * A tela de alocação usa isto para não oferecer alguém que já tem cama — alocar duas vezes
 * é o erro mais fácil de cometer aqui, porque a lista vem do RH inteira, sem saber deste
 * módulo.
 */
export async function funcionariosJaAlocados(): Promise<Set<string>> {
  const ativas = await prisma.alocacao.findMany({
    where: { status: STATUS_ALOCACAO.ATIVA },
    select: { funcionarioId: true },
  })
  return new Set(ativas.map((a) => a.funcionarioId))
}
