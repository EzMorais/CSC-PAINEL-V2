'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { PRIORIDADE_PEDIDO, STATUS_PEDIDO, TIPO_PEDIDO } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const esquema = z.object({
  alojamentoId: z.string().trim().min(1, 'Escolha o alojamento.'),
  tipo: z.enum([TIPO_PEDIDO.LIMPEZA, TIPO_PEDIDO.MANUTENCAO, TIPO_PEDIDO.PESSOAL]),
  titulo: z.string().trim().min(3, 'Descreva o pedido em poucas palavras.'),
  descricao: opcional,
  prioridade: z
    .enum([PRIORIDADE_PEDIDO.BAIXA, PRIORIDADE_PEDIDO.NORMAL, PRIORIDADE_PEDIDO.ALTA])
    .default(PRIORIDADE_PEDIDO.NORMAL),
  alocacaoId: opcional,
})

export async function criarPedido(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    // Guarda o nome de quem pediu junto: a lista de pedidos precisa dizer de quem é sem
    // depender de a alocação continuar existindo.
    const alocacao = d.alocacaoId
      ? await prisma.alocacao.findUnique({ where: { id: d.alocacaoId }, select: { funcionarioNome: true } })
      : null

    const criado = await prisma.pedido.create({
      data: {
        alojamentoId: d.alojamentoId,
        tipo: d.tipo,
        titulo: d.titulo,
        descricao: d.descricao ?? null,
        prioridade: d.prioridade,
        alocacaoId: d.alocacaoId ?? null,
        funcionarioNome: alocacao?.funcionarioNome ?? null,
        registradoPor: sessao.nome,
      },
    })

    revalidarTelas('/', '/pedidos')
    return { ok: true, dados: { id: criado.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar o pedido.' }
  }
}

const esquemaStatus = z.object({
  status: z.enum([
    STATUS_PEDIDO.ABERTO, STATUS_PEDIDO.EM_ANDAMENTO, STATUS_PEDIDO.ATENDIDO, STATUS_PEDIDO.CANCELADO,
  ]),
  respostaObservacao: opcional,
})

/**
 * Anda com o pedido. Quem atendeu e quando ficam gravados no momento em que vira
 * "atendido" — depois ninguém lembra quem resolveu o quê.
 */
export async function atualizarStatusPedido(id: string, entrada: unknown): Promise<Resultado> {
  const sessao = await exigirLancamento()

  const parsed = esquemaStatus.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data
  const encerrando = d.status === STATUS_PEDIDO.ATENDIDO || d.status === STATUS_PEDIDO.CANCELADO

  try {
    await prisma.pedido.update({
      where: { id },
      data: {
        status: d.status,
        respostaObservacao: d.respostaObservacao ?? null,
        atendidoPor: encerrando ? sessao.nome : null,
        atendidoEm: encerrando ? new Date() : null,
      },
    })
    revalidarTelas('/', '/pedidos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao atualizar o pedido.' }
  }
}
