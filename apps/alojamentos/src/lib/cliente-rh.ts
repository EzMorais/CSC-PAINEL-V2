import 'server-only'
import { assinarTokenIntegracao } from '@/lib/integracao'

/** Endereço do RH. Configurável porque um dia os módulos podem sair da mesma máquina. */
const URL_RH = process.env.URL_RH ?? 'http://localhost:3002'

/**
 * Timeout curto de propósito.
 *
 * Quem está alocando alguém está com a tela aberta esperando a lista de funcionários. Se o
 * RH não responde em poucos segundos, a resposta certa é dizer isso na tela — não deixar a
 * pessoa olhando um botão girando.
 */
const TIMEOUT_MS = 5000

export type ResultadoRh<T> = { ok: true; dados: T } | { ok: false; erro: string; permanente: boolean }

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<ResultadoRh<T>> {
  let token: string
  try {
    token = await assinarTokenIntegracao('alojamentos')
  } catch (e) {
    // AUTH_SECRET ausente ou curto: erro de configuração, reenviar não resolve.
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao assinar o token.', permanente: true }
  }

  try {
    const resposta = await fetch(`${URL_RH}${caminho}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null)
      const erro = corpo?.erro ?? `RH respondeu ${resposta.status}.`
      // 4xx é problema do pedido — reenviar igual dá o mesmo erro. 5xx pode ser passageiro.
      return { ok: false, erro, permanente: resposta.status >= 400 && resposta.status < 500 }
    }

    return { ok: true, dados: (await resposta.json()) as T }
  } catch (e) {
    const erro =
      e instanceof Error && e.name === 'TimeoutError'
        ? `O RH não respondeu em ${TIMEOUT_MS / 1000}s.`
        : `Não foi possível falar com o RH em ${URL_RH}. Ele está ligado?`
    return { ok: false, erro, permanente: false }
  }
}

export type FuncionarioRh = {
  id: string
  nome: string
  matricula: string
  cargo: string | null
  obraCodigo: string | null
  departamentoNome: string | null
  departamentoRamo: string | null
  nivelObra: string | null
  foto: string | null
}

/** Quem está na ativa no RH. Desligado não vem — ver o endpoint do lado de lá. */
export async function listarFuncionariosDoRh(): Promise<ResultadoRh<FuncionarioRh[]>> {
  const r = await chamar<{ funcionarios: FuncionarioRh[] }>('/api/integracao/funcionarios')
  return r.ok ? { ok: true, dados: r.dados.funcionarios } : r
}
