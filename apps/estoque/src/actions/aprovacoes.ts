'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirAprovacao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { saldoDoMaterial } from '@/queries/saldos'
import { STATUS_APROVACAO, TIPO_APROVACAO, type TipoAprovacao } from '@/lib/dominio/aprovacoes'
import { MOVIMENTACAO } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

/**
 * O que cada tipo guarda em `dados` enquanto espera decisão.
 *
 * Validado de novo aqui, na hora de executar, e não só quando o pedido foi criado: entre o
 * pedido e a aprovação podem passar dias, e nesse meio-tempo o material pode ter sido
 * inativado ou o saldo pode ter mudado. Confiar no que foi validado lá atrás executaria uma
 * operação que já não é possível.
 */
const esquemaAjuste = z.object({
  materialId: z.string().min(1),
  quantidadeContada: z.number().nonnegative(),
  observacao: z.string().optional().nullable(),
})

const esquemaPerda = z.object({
  materialId: z.string().min(1),
  quantidade: z.number().positive(),
  ocorridoEm: z.string().min(1),
  documento: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
})

const esquemaCompra = z.object({ solicitacaoId: z.string().min(1) })

export async function aprovar(id: string): Promise<Resultado<{ referenciaId: string | null }>> {
  const sessao = await exigirAprovacao()

  try {
    const a = await prisma.aprovacao.findUnique({ where: { id } })
    if (!a) return { ok: false, erro: 'Pedido de aprovação não encontrado.' }
    if (a.status !== STATUS_APROVACAO.PENDENTE) {
      return { ok: false, erro: `Este pedido já foi ${a.status === STATUS_APROVACAO.APROVADA ? 'aprovado' : 'recusado'}.` }
    }

    // Quem pediu não aprova o próprio pedido, mesmo sendo gerente. É a regra inteira da
    // segregação: sem isto, um gerente lançaria e assinaria sozinho, e a fila viraria
    // decoração.
    if (a.solicitanteId === sessao.id) {
      return { ok: false, erro: 'Você fez este pedido — quem aprova tem de ser outra pessoa.' }
    }

    const dados = JSON.parse(a.dados) as unknown
    let referenciaId: string | null = null

    switch (a.tipo as TipoAprovacao) {
      case TIPO_APROVACAO.AJUSTE_INVENTARIO: {
        const d = esquemaAjuste.parse(dados)
        const material = await prisma.material.findUnique({ where: { id: d.materialId }, select: { ativo: true } })
        if (!material) return { ok: false, erro: 'O material deste pedido não existe mais.' }
        if (!material.ativo) return { ok: false, erro: 'O material foi inativado depois do pedido. Reative antes de aprovar.' }

        const saldo = await saldoDoMaterial(d.materialId)
        const diferenca = d.quantidadeContada - saldo
        if (diferenca === 0) {
          return { ok: false, erro: 'O saldo mudou desde o pedido e agora bate com a contagem — nada a ajustar. Recuse o pedido.' }
        }

        const mov = await prisma.movimentacao.create({
          data: {
            materialId: d.materialId,
            tipo: diferenca > 0 ? MOVIMENTACAO.AJUSTE_POSITIVO : MOVIMENTACAO.AJUSTE_NEGATIVO,
            quantidade: Math.abs(diferenca),
            ocorridoEm: new Date(),
            registradoPor: `${a.solicitanteNome} (aprovado por ${sessao.nome})`,
            observacao:
              `Inventário: contado ${d.quantidadeContada}, sistema apontava ${saldo}.` +
              (d.observacao ? ` ${d.observacao}` : ''),
          },
        })
        referenciaId = mov.id
        break
      }

      case TIPO_APROVACAO.PERDA: {
        const d = esquemaPerda.parse(dados)
        const material = await prisma.material.findUnique({
          where: { id: d.materialId },
          select: { ativo: true, nome: true, unidade: true },
        })
        if (!material) return { ok: false, erro: 'O material deste pedido não existe mais.' }
        if (!material.ativo) return { ok: false, erro: 'O material foi inativado depois do pedido. Reative antes de aprovar.' }

        const saldo = await saldoDoMaterial(d.materialId)
        if (d.quantidade > saldo) {
          return {
            ok: false,
            erro:
              `O saldo caiu para ${saldo} ${material.unidade} desde o pedido, e a baixa é de ` +
              `${d.quantidade}. Recuse e peça um novo pedido com a quantidade certa.`,
          }
        }

        const mov = await prisma.movimentacao.create({
          data: {
            materialId: d.materialId,
            tipo: MOVIMENTACAO.PERDA,
            quantidade: d.quantidade,
            ocorridoEm: new Date(d.ocorridoEm),
            documento: d.documento ?? null,
            observacao: d.observacao ?? null,
            registradoPor: `${a.solicitanteNome} (aprovado por ${sessao.nome})`,
          },
        })
        referenciaId = mov.id
        break
      }

      case TIPO_APROVACAO.SOLICITACAO_COMPRA: {
        const d = esquemaCompra.parse(dados)
        const s = await prisma.solicitacaoCompra.findUnique({ where: { id: d.solicitacaoId }, select: { id: true } })
        if (!s) return { ok: false, erro: 'A solicitação deste pedido não existe mais.' }

        // O e-mail só sai agora. Importar aqui dentro, e não no topo, evita um ciclo entre
        // este módulo e `actions/solicitacoes.ts`, que precisa chamar `pedirAprovacao`.
        const { dispararEmailDaSolicitacao } = await import('./solicitacoes')
        await dispararEmailDaSolicitacao(d.solicitacaoId, null)
        referenciaId = d.solicitacaoId
        break
      }

      default:
        return { ok: false, erro: `Tipo de aprovação desconhecido: ${a.tipo}` }
    }

    await prisma.aprovacao.update({
      where: { id },
      data: {
        status: STATUS_APROVACAO.APROVADA,
        aprovadorId: sessao.id,
        aprovadorNome: sessao.nome,
        decididoEm: new Date(),
        referenciaId,
      },
    })

    revalidarTelas('/', '/aprovacoes', '/materiais', '/movimentacoes', '/solicitacoes')
    return { ok: true, dados: { referenciaId } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao aprovar.' }
  }
}

const esquemaRejeicao = z.object({
  motivo: z.string().trim().min(3, 'Diga por que está recusando — sem isso a pessoa refaz o mesmo pedido.'),
})

export async function rejeitar(id: string, entrada: unknown): Promise<Resultado> {
  const sessao = await exigirAprovacao()

  const parsed = esquemaRejeicao.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    const a = await prisma.aprovacao.findUnique({ where: { id }, select: { status: true, solicitanteId: true } })
    if (!a) return { ok: false, erro: 'Pedido de aprovação não encontrado.' }
    if (a.status !== STATUS_APROVACAO.PENDENTE) return { ok: false, erro: 'Este pedido já foi decidido.' }
    if (a.solicitanteId === sessao.id) {
      return { ok: false, erro: 'Você fez este pedido — quem decide tem de ser outra pessoa.' }
    }

    await prisma.aprovacao.update({
      where: { id },
      data: {
        status: STATUS_APROVACAO.REJEITADA,
        aprovadorId: sessao.id,
        aprovadorNome: sessao.nome,
        motivoRejeicao: parsed.data.motivo,
        decididoEm: new Date(),
      },
    })

    revalidarTelas('/', '/aprovacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao recusar.' }
  }
}
