import 'server-only'
import { assinarTokenIntegracao } from '@/lib/integracao'
import { MODULO, URL_MODULO, ROTULO_MODULO, type Modulo } from '@/lib/dominio/cargos'

/**
 * Busca o resumo de cada módulo para o dashboard geral.
 *
 * Timeout curto de propósito: são cinco servidores independentes, e é normal a empresa ter
 * só dois ligados. Um módulo desligado precisa virar um cartão dizendo "não respondeu" em
 * segundos — não uma tela travada porque o quinto sistema está fora do ar.
 */
const TIMEOUT_MS = 4000

export type Tom = 'destaque' | 'bom' | 'alerta' | 'perigo' | 'neutro'

export type Indicador = { rotulo: string; valor: string; tom: Tom }

export type ResumoModulo =
  | { modulo: Modulo; rotulo: string; url: string; ok: true; indicadores: Indicador[] }
  | { modulo: Modulo; rotulo: string; url: string; ok: false; erro: string }

/** Cadastros mora dentro do Portal — não tem servidor próprio para consultar. */
const MODULOS_REMOTOS: Modulo[] = [
  MODULO.PROGRAMACAO, MODULO.PAINEL, MODULO.RH, MODULO.ESTOQUE, MODULO.ALOJAMENTOS, MODULO.FROTA,
]

async function buscarResumo(modulo: Modulo): Promise<ResumoModulo> {
  const url = URL_MODULO[modulo]
  const base = { modulo, rotulo: ROTULO_MODULO[modulo], url }

  let token: string
  try {
    token = await assinarTokenIntegracao()
  } catch (e) {
    return { ...base, ok: false, erro: e instanceof Error ? e.message : 'Falha ao assinar o token.' }
  }

  try {
    const resposta = await fetch(`${url}/api/integracao/resumo`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null)
      return { ...base, ok: false, erro: corpo?.erro ?? `respondeu ${resposta.status}` }
    }

    const dados = (await resposta.json()) as { indicadores?: Indicador[] }
    return { ...base, ok: true, indicadores: dados.indicadores ?? [] }
  } catch (e) {
    const erro =
      e instanceof Error && e.name === 'TimeoutError'
        ? `não respondeu em ${TIMEOUT_MS / 1000}s`
        : 'não está no ar'
    return { ...base, ok: false, erro }
  }
}

/**
 * Consulta em paralelo, e só os módulos que a pessoa alcança.
 *
 * Filtrar antes de chamar, e não depois de exibir: buscar o número de um sistema para quem
 * não tem acesso a ele seria vazar o dado pela rede mesmo que a tela não mostrasse.
 */
export async function resumosDosModulos(permitido: (m: Modulo) => boolean): Promise<ResumoModulo[]> {
  const alvos = MODULOS_REMOTOS.filter(permitido)
  return Promise.all(alvos.map(buscarResumo))
}
