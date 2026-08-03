import { PRIORIDADE_PEDIDO, ROTULO_TIPO_PEDIDO, TIPO_PEDIDO, type TipoPedido } from './constantes'

/**
 * O diálogo do WhatsApp, como função pura.
 *
 * Recebe "onde a conversa estava" e "o que a pessoa escreveu", devolve "o que responder" e
 * "o que fazer". Nada de banco aqui — é o que permite conferir cada caminho da conversa sem
 * subir servidor nem parear celular, e é onde os erros de diálogo aparecem.
 */

export const PASSO = {
  AGUARDANDO_TIPO: 'AGUARDANDO_TIPO',
  AGUARDANDO_DESCRICAO: 'AGUARDANDO_DESCRICAO',
  AGUARDANDO_CONFIRMACAO: 'AGUARDANDO_CONFIRMACAO',
} as const

export type Passo = (typeof PASSO)[keyof typeof PASSO]

/** Quanto tempo uma conversa pela metade continua valendo. */
export const MINUTOS_ATE_EXPIRAR = 30

export type EstadoConversa = {
  passo: Passo
  tipoEscolhido: string | null
  descricao: string | null
} | null

export type Morador = {
  alocacaoId: string
  nome: string
  alojamentoId: string
  alojamentoNome: string
}

export type Acao =
  | { tipo: 'NADA' }
  | { tipo: 'SALVAR_CONVERSA'; estado: NonNullable<EstadoConversa> }
  | { tipo: 'LIMPAR_CONVERSA' }
  | {
      tipo: 'CRIAR_PEDIDO'
      pedido: { tipoPedido: TipoPedido; titulo: string; descricao: string | null; prioridade: string }
    }

export type Resultado = { resposta: string; acao: Acao }

/** As opções do menu, na ordem em que aparecem. O número digitado é o índice + 1. */
const OPCOES: TipoPedido[] = [TIPO_PEDIDO.LIMPEZA, TIPO_PEDIDO.MANUTENCAO, TIPO_PEDIDO.PESSOAL]

const MENU = OPCOES.map((t, i) => `${i + 1} - ${ROTULO_TIPO_PEDIDO[t]}`).join('\n')

/**
 * Palavras que voltam ao começo.
 *
 * Precisa existir porque a pessoa erra o passo e não tem botão de voltar: sem uma saída, a
 * única forma de sair de um estado errado seria esperar meia hora expirar.
 */
const CANCELAR = ['cancelar', 'sair', 'parar', 'nao', 'não']
const RECOMECAR = ['menu', 'voltar', 'recomecar', 'recomeçar', 'oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite']

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Resposta a quem escreve de um número que não está em nenhuma alocação ativa. */
export function respostaDesconhecido(): string {
  return (
    'Olá! Não encontrei o seu número no cadastro dos alojamentos, então não consigo abrir ' +
    'um pedido por aqui.\n\n' +
    'Procure o responsável pelo seu alojamento e peça para cadastrar o seu WhatsApp.'
  )
}

function saudacao(morador: Morador): string {
  const primeiro = morador.nome.split(' ')[0]
  return (
    `Olá, ${primeiro}! Alojamento ${morador.alojamentoNome}.\n\n` +
    `O que você precisa?\n${MENU}\n\n` +
    'Responda com o número da opção.'
  )
}

/**
 * O passo seguinte da conversa.
 *
 * `estado` nulo significa conversa nova (ou expirada) — as duas dão no mesmo lugar, o menu,
 * porque para quem está do outro lado não há diferença entre "nunca falei" e "demorei".
 */
export function proximoPasso(estado: EstadoConversa, texto: string, morador: Morador): Resultado {
  const t = normalizar(texto)

  if (CANCELAR.includes(t)) {
    return {
      resposta: 'Tudo bem, cancelei. Quando precisar, é só mandar mensagem de novo.',
      acao: { tipo: 'LIMPAR_CONVERSA' },
    }
  }

  if (!estado || RECOMECAR.includes(t)) {
    return {
      resposta: saudacao(morador),
      acao: {
        tipo: 'SALVAR_CONVERSA',
        estado: { passo: PASSO.AGUARDANDO_TIPO, tipoEscolhido: null, descricao: null },
      },
    }
  }

  if (estado.passo === PASSO.AGUARDANDO_TIPO) {
    const escolha = Number(t)
    const tipo = Number.isInteger(escolha) ? OPCOES[escolha - 1] : undefined

    if (!tipo) {
      return {
        resposta: `Não entendi. Responda com o número da opção:\n${MENU}`,
        acao: { tipo: 'NADA' },
      }
    }

    return {
      resposta:
        `${ROTULO_TIPO_PEDIDO[tipo]}. Agora me conte o que você precisa, em uma mensagem.\n\n` +
        'Quanto mais detalhe, mais rápido resolvem — diga o quarto, se for o caso.',
      acao: {
        tipo: 'SALVAR_CONVERSA',
        estado: { passo: PASSO.AGUARDANDO_DESCRICAO, tipoEscolhido: tipo, descricao: null },
      },
    }
  }

  if (estado.passo === PASSO.AGUARDANDO_DESCRICAO) {
    const descricao = texto.trim()
    if (descricao.length < 5) {
      return {
        resposta: 'Pode explicar um pouco mais? Escreva o que está acontecendo.',
        acao: { tipo: 'NADA' },
      }
    }

    const rotulo = ROTULO_TIPO_PEDIDO[estado.tipoEscolhido as TipoPedido] ?? 'Pedido'
    return {
      resposta:
        `Confere para mim:\n\n*${rotulo}*\n${descricao}\n\n` +
        'Está certo? Responda *sim* para registrar, ou *não* para cancelar.',
      acao: {
        tipo: 'SALVAR_CONVERSA',
        estado: { passo: PASSO.AGUARDANDO_CONFIRMACAO, tipoEscolhido: estado.tipoEscolhido, descricao },
      },
    }
  }

  if (estado.passo === PASSO.AGUARDANDO_CONFIRMACAO) {
    if (!['sim', 's', 'ok', 'isso', 'confirmo', 'certo'].includes(t)) {
      return {
        resposta: 'Não registrei. Escreva de novo o que você precisa, ou mande *menu* para recomeçar.',
        acao: {
          tipo: 'SALVAR_CONVERSA',
          estado: { passo: PASSO.AGUARDANDO_DESCRICAO, tipoEscolhido: estado.tipoEscolhido, descricao: null },
        },
      }
    }

    const descricao = estado.descricao ?? ''
    return {
      // A resposta com o número do pedido é montada por quem grava — só ele conhece o id.
      resposta: '',
      acao: {
        tipo: 'CRIAR_PEDIDO',
        pedido: {
          tipoPedido: estado.tipoEscolhido as TipoPedido,
          titulo: primeiraLinha(descricao),
          descricao: descricao.length > 80 ? descricao : null,
          prioridade: PRIORIDADE_PEDIDO.NORMAL,
        },
      },
    }
  }

  return { resposta: saudacao(morador), acao: { tipo: 'LIMPAR_CONVERSA' } }
}

/**
 * O título do pedido a partir do texto corrido do morador.
 *
 * A lista de pedidos mostra o título; um parágrafo inteiro ali quebraria a leitura da tela,
 * e por isso o texto completo continua na descrição quando é longo.
 */
function primeiraLinha(texto: string): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= 80) return limpo
  const corte = limpo.slice(0, 80)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return `${(ultimoEspaco > 40 ? corte.slice(0, ultimoEspaco) : corte).trim()}…`
}

/** A confirmação enviada depois que o pedido existe de verdade. */
export function respostaPedidoCriado(numero: string): string {
  return (
    `Pronto! Registrei o seu pedido *#${numero}*.\n\n` +
    'Você recebe um aviso aqui quando ele andar. Obrigado!'
  )
}

// ── Grupo ────────────────────────────────────────────────────────────────────

/**
 * No grupo o diálogo é outro: uma mensagem, um pedido.
 *
 * O menu numerado do privado não funciona aqui. Com vinte pessoas na conversa, duas pedindo
 * ao mesmo tempo embaralham o estado, e um robô respondendo a cada "bom dia" vira incômodo
 * — o grupo pede para tirar o número de lá, e a integração morre. Por isso o gatilho: só
 * mensagem que começa com a palavra-chave é lida; todo o resto da conversa é ignorado.
 */
export const GATILHOS = ['#pedido', '#chamado', '/pedido']

/**
 * A palavra do tipo pode vir logo depois do gatilho — `#pedido limpeza sabão acabou`.
 *
 * Sem ela, o tipo é adivinhado pelo texto. Adivinhar erra às vezes, e é por isso que a
 * confirmação enviada ao grupo diz qual tipo entrou: quem pediu vê na hora, e a gestão
 * corrige na tela. O contrário — não classificar — jogaria todo pedido numa pilha só.
 */
const PALAVRA_DO_TIPO: Record<string, TipoPedido> = {
  limpeza: TIPO_PEDIDO.LIMPEZA,
  manutencao: TIPO_PEDIDO.MANUTENCAO,
  manutenção: TIPO_PEDIDO.MANUTENCAO,
  pessoal: TIPO_PEDIDO.PESSOAL,
}

const PISTAS: Array<{ tipo: TipoPedido; termos: string[] }> = [
  { tipo: TIPO_PEDIDO.LIMPEZA, termos: [
    'vassoura', 'detergente', 'sabao', 'sabão', 'desinfetante', 'papel higienico',
    'papel higiênico', 'rodo', 'balde', 'pano', 'lixo', 'agua sanitaria', 'água sanitária',
    'limpeza', 'faxina', 'esponja',
  ] },
  { tipo: TIPO_PEDIDO.MANUTENCAO, termos: [
    'torneira', 'chuveiro', 'vazamento', 'vazando', 'pingando', 'quebrou', 'quebrado',
    'entupido', 'entupiu', 'lampada', 'lâmpada', 'luz', 'tomada', 'porta', 'janela',
    'fechadura', 'infiltracao', 'infiltração', 'gas', 'gás', 'geladeira', 'fogao', 'fogão',
    'ventilador', 'ar condicionado', 'conserto', 'consertar', 'nao esquenta', 'não esquenta',
  ] },
]

export type PedidoDeGrupo = {
  tipoPedido: TipoPedido
  titulo: string
  descricao: string | null
}

/**
 * Lê uma mensagem de grupo. Null quando não é pedido — que é o caso da maioria delas.
 */
export function pedidoDaMensagemDeGrupo(texto: string): PedidoDeGrupo | null {
  const bruto = texto.trim()
  const inicio = normalizar(bruto)

  const gatilho = GATILHOS.find((g) => inicio.startsWith(g))
  if (!gatilho) return null

  let corpo = bruto.slice(gatilho.length).trim()
  // Aceita "#pedido: a torneira..." — os dois-pontos são o jeito natural de escrever.
  if (corpo.startsWith(':') || corpo.startsWith('-')) corpo = corpo.slice(1).trim()

  let tipo: TipoPedido | null = null

  // Tipo declarado logo depois do gatilho tem prioridade sobre qualquer adivinhação.
  const primeira = normalizar(corpo.split(/\s+/)[0] ?? '')
  if (primeira && PALAVRA_DO_TIPO[primeira]) {
    tipo = PALAVRA_DO_TIPO[primeira]
    corpo = corpo.slice(corpo.split(/\s+/)[0].length).trim()
  }

  if (!corpo || corpo.length < 5) return null

  if (!tipo) {
    const alvo = normalizar(corpo)
    tipo = PISTAS.find((p) => p.termos.some((t) => alvo.includes(normalizar(t))))?.tipo
      // Sem pista nenhuma, manutenção: é o que mais aparece num alojamento, e um pedido
      // classificado errado continua visível e corrigível — um pedido não registrado, não.
      ?? TIPO_PEDIDO.MANUTENCAO
  }

  return {
    tipoPedido: tipo,
    titulo: primeiraLinha(corpo),
    descricao: corpo.length > 80 ? corpo : null,
  }
}

/** A confirmação no grupo. Curta de propósito: é uma conversa de muita gente. */
export function respostaPedidoDeGrupo(numero: string, tipo: TipoPedido, quem: string | null): string {
  const nome = quem?.split(' ')[0]
  return (
    `✅ Pedido *#${numero}* registrado${nome ? ` para ${nome}` : ''} — ` +
    `${ROTULO_TIPO_PEDIDO[tipo]}.\nAviso aqui quando andar.`
  )
}

/** Resposta a quem escreve no privado quando o grupo é o caminho esperado. */
export function comoPedirNoGrupo(): string {
  return (
    'Para abrir um pedido no grupo do alojamento, comece a mensagem com *#pedido*.\n\n' +
    'Exemplo:\n_#pedido a torneira do quarto 3 está vazando_'
  )
}
