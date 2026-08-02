import { prisma } from '@/lib/prisma'
import { STATUS_APROVACAO } from '@/lib/dominio/aprovacoes'

export async function listarAprovacoes(status?: string) {
  return prisma.aprovacao.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }],
    take: 200,
  })
}

export type AprovacaoListada = Awaited<ReturnType<typeof listarAprovacoes>>[number]

export async function contarPendentes(): Promise<number> {
  return prisma.aprovacao.count({ where: { status: STATUS_APROVACAO.PENDENTE } })
}

/**
 * Os limites que decidem quando a aprovação é exigida.
 *
 * Moram na mesma linha de configuração do e-mail porque são as duas coisas que o
 * administrador ajusta no Almoxarifado — e porque uma tabela só para dois números seria
 * cerimônia sem ganho. Sem configuração salva, valem os padrões: a regra tem de existir
 * desde o primeiro dia, senão a aprovação só passa a valer quando alguém lembrar de ligá-la.
 */
export async function limitesDeAprovacao(): Promise<{ compra: number; ajuste: number }> {
  const c = await prisma.configuracaoEmail.findUnique({
    where: { id: 'unica' },
    select: { limiteAprovacaoCompra: true, limiteAjusteInventario: true },
  })
  return {
    compra: c?.limiteAprovacaoCompra ?? 1000,
    ajuste: c?.limiteAjusteInventario ?? 10,
  }
}
