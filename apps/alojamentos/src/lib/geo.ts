import 'server-only'

/**
 * Google Maps: endereço → coordenada, e alojamento → obra.
 *
 * Fica desligado até existir uma chave. Sem `GOOGLE_MAPS_API_KEY` no `.env`, todo o resto
 * do módulo funciona igual — só o mapa e a distância ficam de fora, e a tela diz isso em
 * vez de quebrar. É o que permite usar o sistema hoje e ligar o mapa depois.
 *
 * A chave é lida a cada chamada, não no topo do arquivo: lida no topo, o `next build`
 * quebraria em qualquer máquina sem `.env`.
 */
function chave(): string | null {
  const k = process.env.GOOGLE_MAPS_API_KEY
  return k && k.trim() ? k.trim() : null
}

export function mapaConfigurado(): boolean {
  return chave() !== null
}

export type Coordenada = { lat: number; lng: number }
export type ResultadoGeo<T> = { ok: true; dados: T } | { ok: false; erro: string }

const SEM_CHAVE =
  'O mapa ainda não está configurado. Peça ao administrador para cadastrar a chave do ' +
  'Google Maps (GOOGLE_MAPS_API_KEY) no arquivo .env deste módulo.'

/** Endereço escrito → coordenada. Chamado no salvamento, não a cada tecla, para não queimar cota. */
export async function geocodificar(endereco: string): Promise<ResultadoGeo<Coordenada>> {
  const k = chave()
  if (!k) return { ok: false, erro: SEM_CHAVE }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', endereco)
    url.searchParams.set('region', 'br')
    url.searchParams.set('key', k)

    const resposta = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    const corpo = await resposta.json()

    if (corpo.status === 'ZERO_RESULTS') {
      return { ok: false, erro: 'O Google não encontrou esse endereço. Confira o CEP e o número.' }
    }
    if (corpo.status !== 'OK') {
      return { ok: false, erro: `O Google recusou a consulta (${corpo.status}). Confira a chave e o faturamento.` }
    }

    const local = corpo.results?.[0]?.geometry?.location
    if (typeof local?.lat !== 'number' || typeof local?.lng !== 'number') {
      return { ok: false, erro: 'O Google respondeu sem coordenada.' }
    }
    return { ok: true, dados: { lat: local.lat, lng: local.lng } }
  } catch (e) {
    const erro = e instanceof Error && e.name === 'TimeoutError'
      ? 'O Google não respondeu a tempo.'
      : 'Não foi possível falar com o Google Maps.'
    return { ok: false, erro }
  }
}

export type Trajeto = { distanciaKm: number; duracaoMin: number }

/**
 * Distância e tempo de carro entre dois pontos.
 *
 * De carro, não a pé: o que interessa é quanto tempo o ônibus fretado ou a carona leva.
 */
export async function calcularTrajeto(origem: Coordenada, destino: Coordenada): Promise<ResultadoGeo<Trajeto>> {
  const k = chave()
  if (!k) return { ok: false, erro: SEM_CHAVE }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins', `${origem.lat},${origem.lng}`)
    url.searchParams.set('destinations', `${destino.lat},${destino.lng}`)
    url.searchParams.set('mode', 'driving')
    url.searchParams.set('key', k)

    const resposta = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    const corpo = await resposta.json()

    const elemento = corpo.rows?.[0]?.elements?.[0]
    if (corpo.status !== 'OK' || elemento?.status !== 'OK') {
      return { ok: false, erro: 'O Google não conseguiu traçar a rota entre os dois endereços.' }
    }

    return {
      ok: true,
      dados: {
        distanciaKm: Math.round((elemento.distance.value / 1000) * 10) / 10,
        duracaoMin: Math.round(elemento.duration.value / 60),
      },
    }
  } catch {
    return { ok: false, erro: 'Não foi possível falar com o Google Maps.' }
  }
}

/**
 * Endereço da imagem estática do mapa, para um ponto só.
 *
 * Imagem e não mapa interativo: uma ficha de alojamento precisa mostrar onde fica, não
 * deixar o usuário navegar — e a imagem não carrega biblioteca nenhuma no navegador.
 *
 * Usa a chave pública (`NEXT_PUBLIC_`), que é visível no código-fonte da página por
 * natureza. Ela tem de ser restrita por domínio no painel do Google; a chave do servidor,
 * usada nas funções acima, nunca sai daqui.
 */
export function urlMapaEstatico(lat: number, lng: number, zoom = 15): string | null {
  const k = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!k) return null
  const p = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: '640x280',
    scale: '2',
    maptype: 'roadmap',
    markers: `color:0xd97706|${lat},${lng}`,
    key: k,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${p}`
}
