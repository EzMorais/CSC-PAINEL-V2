import { Boom } from '@hapi/boom'
import pino from 'pino'
import QRCode from 'qrcode'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from 'baileys'
import { FilaDeEnvio } from './fila.js'
import { assinarTokenIntegracao } from './integracao.js'

/**
 * A conexão com o WhatsApp, como DISPOSITIVO VINCULADO.
 *
 * É o mesmo mecanismo do WhatsApp Web: o número segue funcionando normalmente no celular,
 * e este serviço aparece na lista de "aparelhos conectados". Foi a escolha feita para não
 * perder o aplicativo no celular corporativo — a API oficial da Meta exige um número
 * dedicado, que deixa de abrir no app.
 *
 * O preço dessa escolha, registrado aqui para quem for mexer depois: a biblioteca é
 * não-oficial e o uso contraria os termos do WhatsApp. O risco real de banimento vem de
 * disparo em massa para quem não pediu — por isso a regra do módulo é só responder a quem
 * escreveu e só avisar quem tem pedido em aberto. Não afrouxe isso.
 */

const PASTA_SESSAO = process.env.PASTA_SESSAO ?? './sessao'
const URL_ALOJAMENTOS = process.env.URL_ALOJAMENTOS ?? 'http://localhost:3005'

/** Silencioso: o Baileys loga cada pacote do protocolo, e isso esconde o que importa. */
const logger = pino({ level: process.env.LOG_BAILEYS ?? 'silent' })

export type Estado = {
  conectado: boolean
  /** PNG em data URL, pronto para um <img>. Só existe enquanto o pareamento está pendente. */
  qr: string | null
  numero: string | null
  desde: string | null
  ultimoErro: string | null
  naFila: number
}

let socket: WASocket | null = null
let qrAtual: string | null = null
let conectado = false
let numero: string | null = null
let desde: string | null = null
let ultimoErro: string | null = null
let encerrando = false

const fila = new FilaDeEnvio()

export function estado(): Estado {
  return { conectado, qr: qrAtual, numero, desde, ultimoErro, naFila: fila.tamanho }
}

export async function conectar(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(PASTA_SESSAO)
  const { version } = await fetchLatestBaileysVersion()

  socket = makeWASocket({
    version,
    auth: state,
    logger,
    // O QR vai para a tela de configurações do Alojamentos, não para o terminal: quem
    // pareia o celular é o pessoal do escritório, que não tem terminal aberto.
    printQRInTerminal: false,
    markOnlineOnConnect: false,
  })

  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u

    if (qr) {
      QRCode.toDataURL(qr, { margin: 1, width: 320 })
        .then((dataUrl) => { qrAtual = dataUrl })
        .catch(() => { qrAtual = null })
    }

    if (connection === 'open') {
      conectado = true
      qrAtual = null
      ultimoErro = null
      desde = new Date().toISOString()
      numero = socket?.user?.id?.split(':')[0] ?? null
      console.log(`[whatsapp] conectado como ${numero}`)
    }

    if (connection === 'close') {
      conectado = false
      const motivo = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode

      // Sessão derrubada de propósito (aparelho desvinculado no celular, ou banimento):
      // reconectar em laço só queimaria o número. A sessão precisa ser apagada e o QR lido
      // de novo — por isso o serviço para e avisa em vez de insistir.
      if (motivo === DisconnectReason.loggedOut) {
        ultimoErro =
          'A sessão foi encerrada no celular. Apague a pasta da sessão e leia o QR de novo.'
        console.error(`[whatsapp] ${ultimoErro}`)
        return
      }

      if (encerrando) return

      ultimoErro = `Conexão caiu (${motivo ?? 'motivo desconhecido'}). Reconectando…`
      console.warn(`[whatsapp] ${ultimoErro}`)
      setTimeout(() => { void conectar() }, 5000)
    }
  })

  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    // `append` é histórico sendo sincronizado — reprocessar isso responderia a mensagens
    // antigas na hora do pareamento, o que para o morador parece o sistema enlouquecendo.
    if (type !== 'notify') return

    for (const m of messages) {
      try {
        await tratarMensagem(m)
      } catch (e) {
        console.error('[whatsapp] falha ao tratar mensagem:', e)
      }
    }
  })
}

/* eslint-disable @typescript-eslint/no-explicit-any -- o tipo de mensagem do Baileys é
   profundo e instável entre versões; só alguns campos interessam. */
async function tratarMensagem(m: any) {
  const jid: string | undefined = m.key?.remoteJid
  if (!jid || m.key?.fromMe) return

  const ehGrupo = jid.endsWith('@g.us')
  // "status@broadcast" e canais não são conversa com a empresa.
  if (!ehGrupo && !jid.endsWith('@s.whatsapp.net')) return

  const texto: string =
    m.message?.conversation ??
    m.message?.extendedTextMessage?.text ??
    m.message?.imageMessage?.caption ??
    m.message?.videoMessage?.caption ??
    ''

  if (!texto.trim()) {
    // No privado, avisar que só se lê texto é melhor que o silêncio — a pessoa mandou
    // áudio esperando resposta. No GRUPO, calar: responder a cada figurinha de uma
    // conversa de vinte pessoas transformaria o sistema em incômodo, e o grupo pediria
    // para tirar o número de lá.
    if (!ehGrupo) {
      await enviar(jid, 'Por enquanto eu só entendo mensagem de texto. Pode escrever?')
    }
    return
  }

  // Em grupo, quem escreveu vem em `participant`; no privado, é o próprio jid da conversa.
  // O sufixo depois de ":" é o aparelho (celular, web) e não faz parte do número.
  const remetente: string = ehGrupo ? String(m.key?.participant ?? '') : jid
  const telefone = remetente.split('@')[0].split(':')[0]

  const resposta = await entregarAoAlojamentos({
    telefone,
    texto: texto.trim(),
    mensagemId: String(m.key?.id ?? ''),
    grupoId: ehGrupo ? jid : null,
    nomeRemetente: m.pushName ? String(m.pushName) : null,
  })

  // Responde onde a conversa aconteceu: no grupo, no grupo; no privado, no privado.
  if (resposta) await enviar(jid, resposta)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Entrega o que chegou e devolve o que responder.
 *
 * Toda a decisão — quem é a pessoa, em que passo da conversa está, se vira pedido — mora no
 * Alojamentos. Este serviço é transporte: assim a regra fica junto do banco que ela consulta,
 * e trocar o Baileys pela API oficial um dia não mexe em nenhuma regra.
 */
type Recebida = {
  telefone: string
  texto: string
  mensagemId: string
  grupoId: string | null
  nomeRemetente: string | null
}

async function entregarAoAlojamentos(dados: Recebida): Promise<string | null> {
  try {
    const token = await assinarTokenIntegracao()
    const r = await fetch(`${URL_ALOJAMENTOS}/api/integracao/whatsapp/recebida`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(dados),
      signal: AbortSignal.timeout(10000),
    })

    if (!r.ok) {
      console.error(`[whatsapp] Alojamentos respondeu ${r.status}`)
      // Em grupo o silêncio é preferível a um erro para vinte pessoas que não pediram nada;
      // quem escreveu vai repetir. No privado, quem mandou está esperando resposta.
      return dados.grupoId
        ? null
        : 'Tive um problema para registrar aqui. Avise o responsável pelo alojamento, por favor.'
    }

    const resposta = (await r.json()) as { resposta?: string | null }
    return resposta.resposta ?? null
  } catch (e) {
    console.error('[whatsapp] Alojamentos não respondeu:', e)
    return dados.grupoId
      ? null
      : 'O sistema está fora do ar agora. Avise o responsável pelo alojamento, por favor.'
  }
}

/**
 * Os grupos em que o número está, para a tela de configuração ligar cada um ao alojamento.
 *
 * Sem isto, alguém teria de descobrir e digitar à mão o identificador de cada grupo — que
 * não aparece em lugar nenhum do aplicativo.
 */
export async function listarGrupos(): Promise<Array<{ id: string; nome: string; participantes: number }>> {
  if (!socket || !conectado) throw new Error('WhatsApp não está conectado.')
  const grupos = await socket.groupFetchAllParticipating()
  return Object.values(grupos)
    .map((g) => ({ id: g.id, nome: g.subject ?? '(sem nome)', participantes: g.participants?.length ?? 0 }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * Envia uma mensagem. Passa pela fila — ver o comentário em `fila.ts`.
 *
 * `destino` é o jid completo quando termina em `@g.us` ou `@s.whatsapp.net`; qualquer outra
 * coisa é tratada como número de telefone. Aceitar os dois evita que quem chama precise
 * saber a forma interna do WhatsApp para mandar uma mensagem.
 */
export async function enviar(destino: string, texto: string): Promise<void> {
  const jid = destino.includes('@') ? destino : `${destino.replace(/\D/g, '')}@s.whatsapp.net`
  return fila.enfileirar(async () => {
    if (!socket || !conectado) throw new Error('WhatsApp não está conectado.')
    await socket.sendMessage(jid, { text: texto })
  })
}

export function encerrar() {
  encerrando = true
  socket?.end(undefined)
}
