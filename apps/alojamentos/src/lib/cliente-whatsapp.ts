import 'server-only'
import { assinarTokenIntegracao } from '@/lib/integracao'
import { prisma } from '@/lib/prisma'
import { telefoneParaWhatsapp } from '@/lib/whatsapp'

/**
 * Cliente do serviço de WhatsApp (`apps/whatsapp`).
 *
 * O serviço é separado porque a conexão com o WhatsApp é uma só e precisa ficar viva: o
 * Next.js reinicia a cada alteração e pode subir em mais de um processo, e duas conexões
 * disputando o mesmo número derrubam as duas.
 */
const URL_WHATSAPP = process.env.URL_WHATSAPP ?? 'http://localhost:3006'

/**
 * Curto de propósito: nenhum aviso de WhatsApp vale segurar a tela de quem está mudando o
 * status de um pedido. Se não deu, fica registrado e a pessoa reenvia.
 */
const TIMEOUT_MS = 6000

export type EstadoWhatsapp = {
  conectado: boolean
  qr: string | null
  numero: string | null
  desde: string | null
  ultimoErro: string | null
  naFila: number
}

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string }

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<Resultado<T>> {
  let token: string
  try {
    token = await assinarTokenIntegracao('alojamentos')
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao assinar o token.' }
  }

  try {
    const r = await fetch(`${URL_WHATSAPP}${caminho}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!r.ok) {
      const corpo = await r.json().catch(() => null)
      return { ok: false, erro: corpo?.erro ?? `serviço respondeu ${r.status}` }
    }
    return { ok: true, dados: (await r.json()) as T }
  } catch (e) {
    const erro =
      e instanceof Error && e.name === 'TimeoutError'
        ? `o serviço de WhatsApp não respondeu em ${TIMEOUT_MS / 1000}s`
        : `o serviço de WhatsApp não está no ar em ${URL_WHATSAPP}`
    return { ok: false, erro }
  }
}

export async function estadoWhatsapp(): Promise<Resultado<EstadoWhatsapp>> {
  return chamar<EstadoWhatsapp>('/estado')
}

/**
 * Envia e registra — inclusive quando falha.
 *
 * Registrar a falha é o ponto: sem isso, um aviso que não saiu some sem deixar rastro, e a
 * primeira notícia é o morador reclamando que ninguém respondeu. Com o registro, a tela
 * mostra o que não foi e permite reenviar. Nunca lança: um aviso que falhou não pode
 * desfazer a mudança de status que já foi gravada.
 */
export async function enviarWhatsapp(
  destino: string | null | undefined,
  texto: string,
  pedidoId?: string,
): Promise<Resultado<void>> {
  if (!destino?.trim()) return { ok: false, erro: 'Destino ausente.' }

  // Grupo já vem no formato do WhatsApp e não passa pela normalização de telefone — ela
  // arrancaria os caracteres não numéricos e transformaria o jid em lixo.
  const ehGrupo = destino.includes('@g.us')
  const alvo = ehGrupo ? destino.trim() : telefoneParaWhatsapp(destino)
  if (!alvo) return { ok: false, erro: 'Telefone ausente ou inválido.' }

  const r = await chamar<{ ok: boolean }>('/enviar', {
    method: 'POST',
    body: JSON.stringify({ destino: alvo, texto }),
  })

  try {
    await prisma.mensagemWhatsapp.create({
      data: {
        telefone: ehGrupo ? '' : alvo,
        grupoId: ehGrupo ? alvo : null,
        direcao: 'ENVIADA',
        texto,
        pedidoId: pedidoId ?? null,
        erro: r.ok ? null : r.erro,
      },
    })
  } catch {
    // Falhar em anotar não desfaz o envio que já aconteceu.
  }

  return r.ok ? { ok: true, dados: undefined } : r
}

export type GrupoWhatsapp = { id: string; nome: string; participantes: number }

export async function listarGruposWhatsapp(): Promise<Resultado<GrupoWhatsapp[]>> {
  const r = await chamar<{ grupos: GrupoWhatsapp[] }>('/grupos')
  return r.ok ? { ok: true, dados: r.dados.grupos } : r
}
