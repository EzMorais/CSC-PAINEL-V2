import { prisma } from '@/lib/prisma'
import { saldoDoMaterial } from './saldos'
import { situacaoDoSaldo } from '@/lib/dominio/constantes'

export async function obterMaterial(id: string) {
  const [material, saldo] = await Promise.all([
    prisma.material.findUnique({
      where: { id },
      include: {
        movimentacoes: {
          // Desempate por registro: duas movimentações no mesmo dia sairiam em ordem
          // arbitrária só com `ocorridoEm`, e no extrato a ordem é o que explica o saldo.
          orderBy: [{ ocorridoEm: 'desc' }, { registradoEm: 'desc' }],
          include: {
            obra: { select: { codigo: true, descricao: true } },
            fornecedor: { select: { nome: true } },
          },
        },
      },
    }),
    saldoDoMaterial(id),
  ])

  if (!material) return null
  return { ...material, saldo, situacao: situacaoDoSaldo(saldo, material.estoqueMinimo) }
}

export type MaterialDetalhe = NonNullable<Awaited<ReturnType<typeof obterMaterial>>>

/** Listas para os selects dos formulários. */
export async function opcoes() {
  const [materiais, obras, fornecedores] = await Promise.all([
    prisma.material.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, codigo: true, nome: true, unidade: true },
    }),
    prisma.obra.findMany({
      where: { ativa: true },
      orderBy: { codigo: 'asc' },
      select: { id: true, codigo: true, descricao: true },
    }),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ])
  return { materiais, obras, fornecedores }
}

export type Opcoes = Awaited<ReturnType<typeof opcoes>>

/**
 * Próximo código livre, no formato MAT-0001.
 *
 * Lê o maior número existente em vez de contar registros: contar daria colisão assim que
 * alguém fosse excluído do cadastro.
 */
export async function proximoCodigo(): Promise<string> {
  const ultimo = await prisma.material.findFirst({
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  })
  const numero = ultimo ? Number(ultimo.codigo.replace(/\D/g, '')) + 1 : 1
  return `MAT-${String(numero).padStart(4, '0')}`
}
