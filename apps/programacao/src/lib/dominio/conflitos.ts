import { TIPO_RECURSO } from './constantes'

/**
 * O que está errado no quadro — conferido em função pura, sem banco.
 *
 * Existe porque é justamente isto que o Excel não faz. Hoje o mesmo carro entra em duas
 * frentes e ninguém percebe até de manhã, com duas turmas esperando o mesmo Doblô; e um
 * veículo que entrou na oficina continua sendo escalado porque quem monta a programação à
 * noite não viu a manutenção aberta de manhã.
 *
 * Tudo aqui é AVISO, não impedimento. Escalar o mesmo carro em duas frentes pode ser
 * proposital (leva a turma e volta), e travar o quadro faria o chefe voltar para o Excel,
 * onde nada trava. Mostrar e deixar decidir é o que mantém a ferramenta em uso.
 */

export type Gravidade = 'alta' | 'media'

export type Conflito = {
  gravidade: Gravidade
  titulo: string
  detalhe: string
  frenteIds: string[]
}

type EscalaMin = { id: string; frenteId: string; nome: string; funcaoSigla: string | null }
type RecursoMin = {
  id: string; frenteId: string; tipo: string
  placa: string | null; descricao: string; motoristaNome: string | null
}
type FrenteMin = { id: string; nome: string }
type VeiculoMin = { placa: string; emManutencao: boolean; motivoManutencao: string | null }

function normalizar(t: string): string {
  return t.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function conferirQuadro(
  escalas: EscalaMin[],
  recursos: RecursoMin[],
  frentes: FrenteMin[],
  veiculosDaFrota: VeiculoMin[],
): Conflito[] {
  const nomeDaFrente = new Map(frentes.map((f) => [f.id, f.nome]))
  const conflitos: Conflito[] = []

  // ── Mesma pessoa em duas frentes ───────────────────────────────────────────
  const frentesPorPessoa = new Map<string, Set<string>>()
  for (const e of escalas) {
    const chave = normalizar(e.nome)
    if (!frentesPorPessoa.has(chave)) frentesPorPessoa.set(chave, new Set())
    frentesPorPessoa.get(chave)!.add(e.frenteId)
  }
  for (const [chave, ids] of frentesPorPessoa) {
    if (ids.size < 2) continue
    const nome = escalas.find((e) => normalizar(e.nome) === chave)!.nome
    conflitos.push({
      gravidade: 'alta',
      titulo: `${nome} está em ${ids.size} frentes`,
      detalhe: [...ids].map((i) => nomeDaFrente.get(i) ?? '?').join(' e '),
      frenteIds: [...ids],
    })
  }

  // ── Mesmo veículo em duas frentes ──────────────────────────────────────────
  const frentesPorPlaca = new Map<string, Set<string>>()
  for (const r of recursos) {
    if (r.tipo !== TIPO_RECURSO.VEICULO || !r.placa) continue
    const chave = r.placa.replace(/\W/g, '').toUpperCase()
    if (!frentesPorPlaca.has(chave)) frentesPorPlaca.set(chave, new Set())
    frentesPorPlaca.get(chave)!.add(r.frenteId)
  }
  for (const [placa, ids] of frentesPorPlaca) {
    if (ids.size < 2) continue
    conflitos.push({
      gravidade: 'alta',
      titulo: `Veículo ${placa} em ${ids.size} frentes`,
      detalhe: [...ids].map((i) => nomeDaFrente.get(i) ?? '?').join(' e '),
      frenteIds: [...ids],
    })
  }

  // ── Veículo com manutenção aberta ──────────────────────────────────────────
  const naOficina = new Map(
    veiculosDaFrota.filter((v) => v.emManutencao).map((v) => [v.placa.replace(/\W/g, '').toUpperCase(), v]),
  )
  for (const r of recursos) {
    if (r.tipo !== TIPO_RECURSO.VEICULO || !r.placa) continue
    const v = naOficina.get(r.placa.replace(/\W/g, '').toUpperCase())
    if (!v) continue
    conflitos.push({
      gravidade: 'alta',
      titulo: `${r.descricao} está em manutenção`,
      detalhe: `${nomeDaFrente.get(r.frenteId) ?? '?'} · ${v.motivoManutencao ?? 'manutenção aberta na Frota'}`,
      frenteIds: [r.frenteId],
    })
  }

  // ── Motorista escalado em outra frente ─────────────────────────────────────
  for (const r of recursos) {
    if (!r.motoristaNome?.trim()) continue
    const alvo = normalizar(r.motoristaNome)
    const ondeEsta = escalas.filter((e) => normalizar(e.nome) === alvo).map((e) => e.frenteId)
    if (ondeEsta.length === 0) {
      conflitos.push({
        gravidade: 'media',
        titulo: `${r.motoristaNome} dirige mas não está escalado`,
        detalhe: `${r.descricao} · ${nomeDaFrente.get(r.frenteId) ?? '?'}`,
        frenteIds: [r.frenteId],
      })
      continue
    }
    if (!ondeEsta.includes(r.frenteId)) {
      conflitos.push({
        gravidade: 'media',
        titulo: `${r.motoristaNome} dirige em uma frente e trabalha em outra`,
        detalhe:
          `${r.descricao} está em ${nomeDaFrente.get(r.frenteId) ?? '?'}, ` +
          `e ele está escalado em ${ondeEsta.map((i) => nomeDaFrente.get(i) ?? '?').join(', ')}`,
        frenteIds: [r.frenteId, ...ondeEsta],
      })
    }
  }

  // ── Veículo sem motorista ──────────────────────────────────────────────────
  for (const r of recursos) {
    if (r.tipo !== TIPO_RECURSO.VEICULO || r.motoristaNome?.trim()) continue
    conflitos.push({
      gravidade: 'media',
      titulo: `${r.descricao} sem motorista`,
      detalhe: nomeDaFrente.get(r.frenteId) ?? '?',
      frenteIds: [r.frenteId],
    })
  }

  const peso = { alta: 0, media: 1 }
  return conflitos.sort((a, b) => peso[a.gravidade] - peso[b.gravidade])
}
