import 'server-only'
import { prisma } from '@/lib/prisma'
import { enviarWhatsapp } from '@/lib/cliente-whatsapp'
import { ROTULO_STATUS_PEDIDO, ROTULO_TIPO_PEDIDO, STATUS_PEDIDO, type StatusPedido, type TipoPedido } from '@/lib/dominio/constantes'

/**
 * Os avisos de WhatsApp que o fluxo de pedidos dispara.
 *
 * Duas regras que valem para tudo aqui:
 *
 * 1. **Nunca lançam.** Um aviso que não saiu não pode desfazer o pedido que já foi gravado —
 *    o pedido é o fato, o aviso é a cortesia. Falhas ficam registradas em `MensagemWhatsapp`
 *    e aparecem na tela de configurações.
 *
 * 2. **Só falam com quem já está na conversa.** O morador só recebe aviso do pedido que ELE
 *    abriu pelo WhatsApp; a gestão só recebe do alojamento pelo qual responde. Isso não é
 *    escrúpulo: mandar mensagem a quem não pediu é exatamente o comportamento que faz o
 *    WhatsApp banir um número, e o número aqui é o da construtora.
 */

const ID_CURTO = 6

/** Os últimos caracteres do id, que é o que a pessoa vê e repete ao telefone. */
export function numeroCurto(pedidoId: string): string {
  return pedidoId.slice(-ID_CURTO).toUpperCase()
}

/** Avisa o responsável pelo alojamento que entrou pedido novo. */
export async function avisarGestaoDePedidoNovo(pedidoId: string): Promise<void> {
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { alojamento: { select: { nome: true, telefoneResponsavel: true } } },
    })
    if (!pedido?.alojamento.telefoneResponsavel) return

    const quem = pedido.funcionarioNome ?? pedido.registradoPor ?? 'alguém'
    const texto =
      `*Pedido novo* #${numeroCurto(pedido.id)}\n` +
      `${pedido.alojamento.nome}\n\n` +
      `${ROTULO_TIPO_PEDIDO[pedido.tipo as TipoPedido] ?? pedido.tipo}: ${pedido.titulo}\n` +
      (pedido.descricao ? `${pedido.descricao}\n` : '') +
      `\nDe: ${quem}`

    await enviarWhatsapp(pedido.alojamento.telefoneResponsavel, texto, pedido.id)
  } catch {
    // Ver a regra 1 no topo do arquivo.
  }
}

/**
 * Avisa que o pedido andou.
 *
 * Volta para onde ele foi feito: no grupo do alojamento, se veio de lá — assim todo mundo
 * vê que está sendo tratado, e ninguém pede a mesma coisa de novo. No privado, quando foi
 * conversa individual.
 *
 * Só para pedido que veio do WhatsApp: quem abriu pela tela não deu o número esperando
 * resposta por lá, e escrever para essa pessoa seria iniciar conversa que ela não pediu.
 */
export async function avisarMoradorDeStatus(pedidoId: string, status: StatusPedido): Promise<void> {
  if (status !== STATUS_PEDIDO.EM_ANDAMENTO && status !== STATUS_PEDIDO.ATENDIDO && status !== STATUS_PEDIDO.CANCELADO) {
    return
  }

  try {
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } })
    const destino = pedido?.grupoOrigemId ?? pedido?.telefoneOrigem
    if (!pedido || !destino) return

    const cabecalho =
      status === STATUS_PEDIDO.ATENDIDO ? '✅ *Pedido atendido*'
      : status === STATUS_PEDIDO.CANCELADO ? '❌ *Pedido cancelado*'
      : '🔧 *Pedido em andamento*'

    // No grupo, dizer de quem era o pedido: a mensagem chega para vinte pessoas, e sem o
    // nome ninguém sabe se aquele "#A3F2K1" é o dele.
    const dono = pedido.grupoOrigemId ? (pedido.funcionarioNome ?? pedido.nomeOrigem) : null

    const texto =
      `${cabecalho} #${numeroCurto(pedido.id)}${dono ? ` — ${dono.split(' ')[0]}` : ''}\n\n` +
      `${pedido.titulo}\n` +
      `Situação: ${ROTULO_STATUS_PEDIDO[status]}\n` +
      (pedido.respostaObservacao ? `\n${pedido.respostaObservacao}\n` : '') +
      (status === STATUS_PEDIDO.ATENDIDO ? '\nSe não tiver resolvido, é só responder aqui.' : '')

    await enviarWhatsapp(destino, texto, pedido.id)
  } catch {
    // Ver a regra 1 no topo do arquivo.
  }
}
