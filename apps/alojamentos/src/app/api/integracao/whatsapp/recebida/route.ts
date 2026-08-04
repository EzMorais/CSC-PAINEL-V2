import { prisma } from '@/lib/prisma'
import { verificarTokenIntegracao } from '@/lib/integracao'
import { variantesDoNumero, telefoneParaWhatsapp } from '@/lib/whatsapp'
import { avisarGestaoDePedidoNovo, numeroCurto } from '@/lib/avisos-pedido'
import { revalidarTelas } from '@/lib/revalidar'
import { STATUS_ALOCACAO } from '@/lib/dominio/constantes'
import {
  MINUTOS_ATE_EXPIRAR, proximoPasso, respostaDesconhecido, respostaPedidoCriado,
  pedidoDaMensagemDeGrupo, respostaPedidoDeGrupo, comoPedirNoGrupo,
  type EstadoConversa, type Morador, type Passo,
} from '@/lib/dominio/conversa-whatsapp'

export const dynamic = 'force-dynamic'

/**
 * Onde chega o que o morador escreveu no WhatsApp.
 *
 * Quem fala aqui é o serviço `apps/whatsapp`, autenticado com o mesmo AUTH_SECRET dos
 * outros módulos. A decisão toda mora deste lado — o serviço é transporte. É isso que
 * permite trocar a biblioteca do WhatsApp (ou migrar para a API oficial da Meta) sem
 * reescrever regra nenhuma.
 *
 * Devolve `{ resposta }` com o que responder, ou `resposta: null` para ficar calado.
 */
export async function POST(request: Request) {
  const chamada = await verificarTokenIntegracao(request.headers.get('authorization'))
  if (!chamada) {
    return Response.json({ erro: 'Token de integração ausente ou inválido.' }, { status: 401 })
  }

  let corpo: {
    telefone?: string; texto?: string; mensagemId?: string
    grupoId?: string | null; nomeRemetente?: string | null
  }
  try {
    corpo = await request.json()
  } catch {
    return Response.json({ erro: 'Corpo inválido.' }, { status: 400 })
  }

  const telefone = telefoneParaWhatsapp(corpo.telefone)
  const texto = corpo.texto?.trim()
  if (!telefone || !texto) {
    return Response.json({ erro: 'Informe telefone e texto.' }, { status: 400 })
  }
  const grupoId = corpo.grupoId?.trim() || null

  try {
    // O WhatsApp reentrega a mesma mensagem quando a conexão oscila. Sem esta trava, uma
    // oscilação no momento do "sim" abriria o pedido duas vezes.
    if (corpo.mensagemId) {
      const jaVista = await prisma.mensagemWhatsapp.findFirst({
        where: { externoId: corpo.mensagemId, direcao: 'RECEBIDA' },
      })
      if (jaVista) return Response.json({ resposta: null })
    }

    await prisma.mensagemWhatsapp.create({
      data: { telefone, grupoId, direcao: 'RECEBIDA', texto, externoId: corpo.mensagemId ?? null },
    })

    if (grupoId) {
      return tratarMensagemDeGrupo({ grupoId, telefone, texto, nome: corpo.nomeRemetente ?? null })
    }

    const morador = await acharMorador(telefone)
    if (!morador) {
      // Se este número já falou em algum grupo de alojamento, o caminho dele é o grupo —
      // mandar procurar o responsável seria empurrar para longe quem já está no lugar certo.
      const conheceDeGrupo = await prisma.mensagemWhatsapp.findFirst({
        where: { telefone, grupoId: { not: null } },
      })
      return Response.json({ resposta: conheceDeGrupo ? comoPedirNoGrupo() : respostaDesconhecido() })
    }

    const conversa = await prisma.conversaWhatsapp.findUnique({ where: { telefone } })
    // Conversa vencida vale como conversa nova — ver o comentário de `expiraEm` no schema.
    const estado: EstadoConversa =
      conversa && conversa.expiraEm > new Date()
        ? { passo: conversa.passo as Passo, tipoEscolhido: conversa.tipoEscolhido, descricao: conversa.descricao }
        : null

    const { resposta, acao } = proximoPasso(estado, texto, morador)

    if (acao.tipo === 'LIMPAR_CONVERSA') {
      await prisma.conversaWhatsapp.deleteMany({ where: { telefone } })
    }

    if (acao.tipo === 'SALVAR_CONVERSA') {
      const expiraEm = new Date(Date.now() + MINUTOS_ATE_EXPIRAR * 60_000)
      const dados = {
        passo: acao.estado.passo,
        tipoEscolhido: acao.estado.tipoEscolhido,
        descricao: acao.estado.descricao,
        alocacaoId: morador.alocacaoId,
        expiraEm,
      }
      await prisma.conversaWhatsapp.upsert({
        where: { telefone },
        create: { telefone, ...dados },
        update: dados,
      })
    }

    if (acao.tipo === 'CRIAR_PEDIDO') {
      const criado = await prisma.pedido.create({
        data: {
          alojamentoId: morador.alojamentoId,
          tipo: acao.pedido.tipoPedido,
          titulo: acao.pedido.titulo,
          descricao: acao.pedido.descricao,
          prioridade: acao.pedido.prioridade,
          alocacaoId: morador.alocacaoId,
          funcionarioNome: morador.nome,
          origem: 'WHATSAPP',
          telefoneOrigem: telefone,
          registradoPor: `${morador.nome} (WhatsApp)`,
        },
      })

      await prisma.conversaWhatsapp.deleteMany({ where: { telefone } })
      revalidarTelas('/', '/pedidos')

      // O aviso à gestão vai depois de o pedido existir, e sem travar a resposta ao morador:
      // se o responsável estiver com o WhatsApp fora, quem pediu ainda merece o "registrei".
      void avisarGestaoDePedidoNovo(criado.id)

      return Response.json({ resposta: respostaPedidoCriado(numeroCurto(criado.id)) })
    }

    return Response.json({ resposta: resposta || null })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao tratar a mensagem.'
    return Response.json({ erro }, { status: 500 })
  }
}

/**
 * Mensagem chegada num grupo de alojamento.
 *
 * Uma mensagem, um pedido — sem diálogo. O motivo está em `pedidoDaMensagemDeGrupo`.
 *
 * Fica calado quando não é pedido, e isso é a maior parte das mensagens: o grupo é a
 * conversa do alojamento, não um canal do sistema. Robô que responde tudo é robô que o
 * grupo remove.
 */
async function tratarMensagemDeGrupo(
  { grupoId, telefone, texto, nome }:
  { grupoId: string; telefone: string; texto: string; nome: string | null },
) {
  const alojamento = await prisma.alojamento.findUnique({
    where: { grupoWhatsappId: grupoId },
    select: { id: true, nome: true },
  })
  // Grupo não vinculado a alojamento nenhum: silêncio. Pode ser qualquer grupo em que o
  // número da empresa esteja, e responder ali seria intrometer o sistema onde não foi
  // chamado. O vínculo se faz na tela de WhatsApp.
  if (!alojamento) return Response.json({ resposta: null })

  const pedido = pedidoDaMensagemDeGrupo(texto)
  if (!pedido) return Response.json({ resposta: null })

  // Se o número estiver cadastrado numa alocação, o pedido fica ligado à pessoa. Se não,
  // vale o nome que o WhatsApp mostra: exigir cadastro prévio faria a maior parte dos
  // pedidos ser recusada logo no começo, que é justamente quando ninguém cadastrou nada.
  const morador = await acharMorador(telefone)

  const criado = await prisma.pedido.create({
    data: {
      alojamentoId: alojamento.id,
      tipo: pedido.tipoPedido,
      titulo: pedido.titulo,
      descricao: pedido.descricao,
      prioridade: 'NORMAL',
      alocacaoId: morador?.alocacaoId ?? null,
      funcionarioNome: morador?.nome ?? nome,
      origem: 'WHATSAPP',
      telefoneOrigem: telefone,
      grupoOrigemId: grupoId,
      nomeOrigem: nome,
      registradoPor: `${morador?.nome ?? nome ?? telefone} (grupo ${alojamento.nome})`,
    },
  })

  revalidarTelas('/', '/pedidos')
  void avisarGestaoDePedidoNovo(criado.id)

  return Response.json({
    resposta: respostaPedidoDeGrupo(numeroCurto(criado.id), pedido.tipoPedido, morador?.nome ?? nome),
  })
}

/**
 * De qual morador é este número.
 *
 * Só alocação ATIVA: quem já saiu do alojamento não abre pedido nele. Compara contra todas
 * as formas do número — ver `variantesDoNumero`.
 */
async function acharMorador(telefone: string): Promise<Morador | null> {
  const variantes = variantesDoNumero(telefone)
  if (variantes.length === 0) return null

  const alocacoes = await prisma.alocacao.findMany({
    where: { status: STATUS_ALOCACAO.ATIVA, telefone: { not: null } },
    select: {
      id: true, funcionarioNome: true, telefone: true,
      alojamentoId: true, alojamento: { select: { nome: true } },
    },
  })

  // Comparação em memória, e não no SQL: o cadastro guarda o telefone como a pessoa
  // digitou — "(62) 99999-1234" — e nenhum `where` casaria isso com `5562999991234` sem
  // normalizar os dois lados. São dezenas de moradores, não milhares.
  const achada = alocacoes.find((a) => {
    const dela = variantesDoNumero(a.telefone)
    return dela.some((v) => variantes.includes(v))
  })
  if (!achada) return null

  return {
    alocacaoId: achada.id,
    nome: achada.funcionarioNome,
    alojamentoId: achada.alojamentoId,
    alojamentoNome: achada.alojamento.nome,
  }
}
