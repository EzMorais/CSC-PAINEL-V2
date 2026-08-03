import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { enviar, estado, listarGrupos } from './conexao.js'
import { verificarTokenIntegracao } from './integracao.js'

/**
 * A porta de entrada do serviço. Três rotas, todas autenticadas:
 *
 *   GET  /estado  → como está a conexão (e o QR, quando falta parear)
 *   GET  /grupos  → os grupos em que o número está
 *   POST /enviar  → { destino, texto } — destino é um número ou um jid de grupo
 *
 * Sem tela e sem sessão de usuário: quem tem tela é o Alojamentos, que consulta estas
 * rotas. Deixar o QR exposto sem token seria entregar o pareamento do WhatsApp da empresa
 * a quem alcançasse a porta.
 */
const PORTA = Number(process.env.PORTA_WHATSAPP ?? 3006)

async function lerCorpo(req: IncomingMessage): Promise<unknown> {
  const partes: Buffer[] = []
  for await (const p of req) partes.push(p as Buffer)
  if (partes.length === 0) return null
  return JSON.parse(Buffer.concat(partes).toString('utf8'))
}

function responder(res: ServerResponse, status: number, corpo: unknown) {
  const texto = JSON.stringify(corpo)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(texto)
}

async function tratar(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORTA}`)

  // Verificação de vida, sem token: serve para o contêiner saber se o processo responde.
  // Não conta nada sobre a conexão nem sobre o número — isso fica atrás do token.
  if (url.pathname === '/saude') return responder(res, 200, { ok: true })

  const origem = await verificarTokenIntegracao(req.headers.authorization ?? null)
  if (!origem) return responder(res, 401, { erro: 'Token de integração ausente ou inválido.' })

  if (url.pathname === '/estado' && req.method === 'GET') {
    return responder(res, 200, estado())
  }

  if (url.pathname === '/grupos' && req.method === 'GET') {
    if (!estado().conectado) {
      return responder(res, 503, { erro: 'WhatsApp não está conectado.' })
    }
    try {
      return responder(res, 200, { grupos: await listarGrupos() })
    } catch (e) {
      return responder(res, 503, { erro: e instanceof Error ? e.message : 'Falha ao listar grupos.' })
    }
  }

  if (url.pathname === '/enviar' && req.method === 'POST') {
    const corpo = (await lerCorpo(req)) as { destino?: string; texto?: string } | null
    const destino = corpo?.destino?.trim()
    const texto = corpo?.texto?.trim()

    if (!destino || !texto) {
      return responder(res, 400, { erro: 'Informe destino e texto.' })
    }
    if (!estado().conectado) {
      // 503 e não 500: o Alojamentos distingue "não deu agora, tente de novo" de
      // "esta mensagem nunca vai passar", e só a primeira merece reenvio.
      return responder(res, 503, { erro: 'WhatsApp não está conectado.' })
    }

    try {
      await enviar(destino, texto)
      return responder(res, 200, { ok: true })
    } catch (e) {
      return responder(res, 503, { erro: e instanceof Error ? e.message : 'Falha ao enviar.' })
    }
  }

  return responder(res, 404, { erro: 'Rota não encontrada.' })
}

export function subirServidor() {
  const servidor = createServer((req, res) => {
    tratar(req, res).catch((e) => {
      console.error('[whatsapp] erro na requisição:', e)
      responder(res, 500, { erro: 'Erro interno.' })
    })
  })

  servidor.listen(PORTA, () => {
    console.log(`[whatsapp] serviço ouvindo em http://localhost:${PORTA}`)
  })

  return servidor
}
