import 'server-only'
import { assinarTokenIntegracao } from '@/lib/integracao'

/**
 * Cliente do módulo de RH.
 *
 * Endereço configurável porque um dia os módulos podem sair da mesma máquina; o padrão é o
 * que o `configurar-novo-computador` monta.
 */
const URL_RH = process.env.URL_RH ?? 'http://localhost:3002'

/**
 * Timeout curto de propósito.
 *
 * Este cliente é chamado no meio de uma saída de material, com o almoxarife esperando na
 * tela. Se o RH não responde em poucos segundos, a resposta certa é seguir com a saída e
 * marcar a ficha como pendente — não deixar a pessoa parada olhando um botão girando.
 */
const TIMEOUT_MS = 5000

export type ResultadoRh<T> = { ok: true; dados: T } | { ok: false; erro: string; permanente: boolean }

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<ResultadoRh<T>> {
  let token: string
  try {
    token = await assinarTokenIntegracao('estoque')
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
}

export async function listarFuncionariosDoRh(): Promise<ResultadoRh<FuncionarioRh[]>> {
  const r = await chamar<{ funcionarios: FuncionarioRh[] }>('/api/integracao/funcionarios')
  return r.ok ? { ok: true, dados: r.dados.funcionarios } : r
}

export type FichaEpi = {
  movimentacaoId: string
  funcionarioId: string
  materialCodigo: string
  materialNome: string
  unidade: string
  quantidade: number
  ca: string | null
  validadeCA: string | null
  entregueEm: string
  entreguePor: string | null
  observacao: string | null
}

export async function enviarFichaEpi(ficha: FichaEpi): Promise<ResultadoRh<{ id: string; duplicada: boolean }>> {
  return chamar<{ id: string; duplicada: boolean }>('/api/integracao/entregas-epi', {
    method: 'POST',
    body: JSON.stringify(ficha),
  })
}
