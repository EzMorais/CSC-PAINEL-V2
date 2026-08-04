import 'server-only'
import { assinarTokenIntegracao } from '@/lib/integracao'

/**
 * O que a programação busca nos outros módulos.
 *
 * Três origens, uma para cada coisa que o quadro escala: pessoas no RH, veículos na Frota,
 * máquinas no catálogo do Portal. Nenhuma delas é copiada para cá — copiar criaria um
 * segundo cadastro de gente e de frota para manter, que é o problema que o Portal existe
 * para acabar.
 *
 * Nenhuma falha derruba o quadro. Um módulo fora do ar tira a lista dele da tela e mantém o
 * resto funcionando: com o RH desligado ainda dá para escalar quem já está no quadro de
 * ontem e para digitar avulso, e isso é o que impede a programação de parar por causa de
 * outro sistema.
 */
const URL_RH = process.env.URL_RH ?? 'http://localhost:3002'
const URL_FROTA = process.env.URL_FROTA ?? 'http://localhost:3000'
const URL_PORTAL = process.env.URL_PORTAL ?? 'http://localhost:3004'

const TIMEOUT_MS = 5000

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string }

async function buscar<T>(base: string, caminho: string, nome: string): Promise<Resultado<T>> {
  let token: string
  try {
    token = await assinarTokenIntegracao()
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao assinar o token.' }
  }

  try {
    const r = await fetch(`${base}${caminho}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!r.ok) {
      const corpo = await r.json().catch(() => null)
      return { ok: false, erro: corpo?.erro ?? `${nome} respondeu ${r.status}` }
    }
    return { ok: true, dados: (await r.json()) as T }
  } catch (e) {
    const erro =
      e instanceof Error && e.name === 'TimeoutError'
        ? `${nome} não respondeu em ${TIMEOUT_MS / 1000}s`
        : `${nome} não está no ar`
    return { ok: false, erro }
  }
}

export type FuncionarioRh = {
  id: string
  nome: string
  matricula: string
  cargo: string | null
  obraCodigo: string | null
  departamentoNome?: string | null
  nivelObra?: string | null
}

export async function funcionariosDoRh(): Promise<Resultado<FuncionarioRh[]>> {
  const r = await buscar<{ funcionarios: FuncionarioRh[] }>(URL_RH, '/api/integracao/funcionarios', 'O RH')
  return r.ok ? { ok: true, dados: r.dados.funcionarios } : r
}

export type VeiculoFrota = {
  placa: string
  nome: string
  motorista: string | null
  emManutencao: boolean
  motivoManutencao: string | null
}

export async function veiculosDaFrota(): Promise<Resultado<VeiculoFrota[]>> {
  const r = await buscar<{ veiculos: VeiculoFrota[] }>(URL_FROTA, '/api/integracao/veiculos', 'A Frota')
  return r.ok ? { ok: true, dados: r.dados.veiculos } : r
}

export type MaquinaCatalogo = {
  id: string
  codigo: string
  nome: string
  detalhe: string | null
  identificador: string | null
}

export async function maquinasDoPortal(): Promise<Resultado<MaquinaCatalogo[]>> {
  const r = await buscar<{ itens: MaquinaCatalogo[] }>(
    URL_PORTAL, '/api/integracao/cadastros?tipo=MAQUINA', 'O Portal',
  )
  return r.ok ? { ok: true, dados: r.dados.itens } : r
}
