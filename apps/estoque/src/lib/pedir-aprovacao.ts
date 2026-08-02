import 'server-only'
import { prisma } from '@/lib/prisma'
import { podeAprovar } from '@/lib/dominio/cargos'
import { STATUS_APROVACAO, type TipoAprovacao } from '@/lib/dominio/aprovacoes'

/**
 * Quem pode aprovar não precisa pedir aprovação.
 *
 * Não é uma brecha: a fila existe para o cargo Operacional não fechar sozinho o que mexe em
 * saldo sem contrapartida. O gerente é justamente quem confere — obrigá-lo a pedir só criaria
 * um pedido que ele mesmo não poderia aprovar (a action recusa quem pede o próprio pedido) e
 * travaria o trabalho até aparecer um segundo gerente.
 */
export function precisaAprovacao(cargo: string, excedeLimite: boolean): boolean {
  return excedeLimite && !podeAprovar(cargo)
}

export async function abrirPedido(params: {
  tipo: TipoAprovacao
  resumo: string
  dados: unknown
  motivo?: string | null
  solicitanteId: string
  solicitanteNome: string
}): Promise<{ id: string }> {
  const a = await prisma.aprovacao.create({
    data: {
      tipo: params.tipo,
      status: STATUS_APROVACAO.PENDENTE,
      resumo: params.resumo,
      dados: JSON.stringify(params.dados),
      motivo: params.motivo ?? null,
      solicitanteId: params.solicitanteId,
      solicitanteNome: params.solicitanteNome,
    },
  })
  return { id: a.id }
}
