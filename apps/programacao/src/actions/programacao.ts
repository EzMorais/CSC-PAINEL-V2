'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { diaUtc, paraIso, STATUS_PROGRAMACAO, TIPO_RECURSO } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

/**
 * Campo opcional que aceita ausente, vazio E null.
 *
 * O `null` importa: a tela manda `campo || null` para dizer "não preencheu" — é o caso de
 * quem escala alguém sem função, ou põe um veículo sem motorista. Um esquema que só aceita
 * string recusa isso com "expected string, received null", que não diz nada a quem está na
 * tela e faz o lançamento simplesmente não acontecer.
 */
const opcional = z.string().trim().nullish().transform((v) => (v ? v : null))

const dataCalendario = z
  .string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .transform((v) => {
    const [a, m, d] = v.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, d))
  })

function revalidar(data: Date) {
  revalidarTelas('/', `/dia/${paraIso(data)}`)
}

/** Cria o dia vazio. Idempotente: abrir duas abas não cria duas programações. */
export async function criarDia(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = z.object({ data: dataCalendario }).safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  const data = diaUtc(parsed.data.data)

  try {
    const p = await prisma.programacao.upsert({
      where: { data },
      create: { data },
      update: {},
    })
    revalidar(data)
    return { ok: true, dados: { id: p.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao criar o dia.' }
  }
}

/**
 * Copia a programação de outro dia para este.
 *
 * É a função que economiza o tempo de verdade: quase todo mundo continua na mesma frente, e
 * hoje o quadro inteiro é redigitado toda tarde. Copiando, só se mexe em quem mudou.
 *
 * Substitui o que houver no dia de destino, avisando antes na tela — copiar por cima sem
 * dizer apagaria meia hora de trabalho de quem já tinha começado a montar.
 */
export async function copiarDe(entrada: unknown): Promise<Resultado<{ escalas: number; recursos: number }>> {
  await exigirLancamento()

  const parsed = z.object({ data: dataCalendario, origem: dataCalendario }).safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  const data = diaUtc(parsed.data.data)
  const origem = diaUtc(parsed.data.origem)
  if (data.getTime() === origem.getTime()) {
    return { ok: false, erro: 'A origem e o destino são o mesmo dia.' }
  }

  try {
    const de = await prisma.programacao.findUnique({
      where: { data: origem },
      include: { escalas: true, recursos: true },
    })
    if (!de) return { ok: false, erro: 'Não há programação nesse dia para copiar.' }

    const destino = await prisma.programacao.upsert({ where: { data }, create: { data }, update: {} })

    // Quem tem cadastro fixo local e está inativo ou ausente não atravessa pro dia seguinte —
    // mesma lógica do sistema antigo: copiar em cima da ausência faria alguém de férias
    // aparecer escalado, e o chefe só notaria olhando pro grupo pela manhã.
    const idsLocais = [...new Set(de.escalas.map((e) => e.funcionarioLocalId).filter((v): v is string => !!v))]
    const locaisIndisponiveis = idsLocais.length === 0 ? new Set<string>() : new Set(
      (await prisma.funcionario.findMany({
        where: { id: { in: idsLocais }, OR: [{ ativo: false }, { ausente: true }] },
        select: { id: true },
      })).map((f) => f.id),
    )
    const escalasParaCopiar = de.escalas.filter(
      (e) => !e.funcionarioLocalId || !locaisIndisponiveis.has(e.funcionarioLocalId),
    )

    // Numa transação só: se apagar der certo e criar falhar, o dia ficaria vazio sem
    // ninguém ter pedido isso — e o original de onde copiar já teria sido perdido de vista.
    await prisma.$transaction([
      prisma.escala.deleteMany({ where: { programacaoId: destino.id } }),
      prisma.recurso.deleteMany({ where: { programacaoId: destino.id } }),
      prisma.escala.createMany({
        data: escalasParaCopiar.map((e) => ({
          programacaoId: destino.id, frenteId: e.frenteId,
          funcionarioId: e.funcionarioId, funcionarioLocalId: e.funcionarioLocalId,
          nome: e.nome, funcaoSigla: e.funcaoSigla,
          ordem: e.ordem, observacao: e.observacao,
        })),
      }),
      prisma.recurso.createMany({
        data: de.recursos.map((r) => ({
          programacaoId: destino.id, frenteId: r.frenteId, tipo: r.tipo,
          placa: r.placa, descricao: r.descricao, motoristaNome: r.motoristaNome,
          veiculoLocalId: r.veiculoLocalId,
          destaque: r.destaque, ordem: r.ordem,
        })),
      }),
    ])

    revalidar(data)
    return { ok: true, dados: { escalas: escalasParaCopiar.length, recursos: de.recursos.length } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao copiar.' }
  }
}

// ── Pessoas ──────────────────────────────────────────────────────────────────

const esquemaEscala = z.object({
  data: dataCalendario,
  frenteId: z.string().trim().min(1, 'Escolha a frente.'),
  nome: z.string().trim().min(2, 'Informe o nome.'),
  funcionarioId: opcional,
  funcionarioLocalId: opcional,
  funcaoSigla: opcional,
})

export async function escalar(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquemaEscala.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  const d = parsed.data
  const data = diaUtc(d.data)

  try {
    const p = await prisma.programacao.upsert({ where: { data }, create: { data }, update: {} })

    const ultima = await prisma.escala.findFirst({
      where: { programacaoId: p.id, frenteId: d.frenteId },
      orderBy: { ordem: 'desc' }, select: { ordem: true },
    })

    const criada = await prisma.escala.create({
      data: {
        programacaoId: p.id, frenteId: d.frenteId,
        funcionarioId: d.funcionarioId, funcionarioLocalId: d.funcionarioLocalId,
        nome: d.nome, funcaoSigla: d.funcaoSigla,
        ordem: (ultima?.ordem ?? 0) + 1,
      },
    })
    revalidar(data)
    return { ok: true, dados: { id: criada.id } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `${d.nome} já está nessa frente neste dia.`
      : 'Falha ao escalar.'
    return { ok: false, erro: msg }
  }
}

/** Move a pessoa para outra frente — é o que o arrastar faz. */
export async function moverEscala(id: string, frenteId: string): Promise<Resultado> {
  await exigirLancamento()

  try {
    const atual = await prisma.escala.findUnique({
      where: { id },
      include: { programacao: { select: { data: true } } },
    })
    if (!atual) return { ok: false, erro: 'Escala não encontrada.' }
    if (atual.frenteId === frenteId) return { ok: true, dados: undefined }

    const jaEsta = await prisma.escala.findFirst({
      where: { programacaoId: atual.programacaoId, frenteId, nome: atual.nome },
    })
    if (jaEsta) return { ok: false, erro: `${atual.nome} já está nessa frente.` }

    const ultima = await prisma.escala.findFirst({
      where: { programacaoId: atual.programacaoId, frenteId },
      orderBy: { ordem: 'desc' }, select: { ordem: true },
    })

    await prisma.escala.update({
      where: { id },
      data: { frenteId, ordem: (ultima?.ordem ?? 0) + 1 },
    })
    revalidar(atual.programacao.data)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao mover.' }
  }
}

export async function tirarEscala(id: string): Promise<Resultado> {
  await exigirLancamento()
  try {
    const atual = await prisma.escala.findUnique({
      where: { id }, include: { programacao: { select: { data: true } } },
    })
    if (!atual) return { ok: false, erro: 'Escala não encontrada.' }
    await prisma.escala.delete({ where: { id } })
    revalidar(atual.programacao.data)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao remover.' }
  }
}

export async function trocarFuncao(id: string, funcaoSigla: string): Promise<Resultado> {
  await exigirLancamento()
  try {
    const atual = await prisma.escala.findUnique({
      where: { id }, include: { programacao: { select: { data: true } } },
    })
    if (!atual) return { ok: false, erro: 'Escala não encontrada.' }
    await prisma.escala.update({ where: { id }, data: { funcaoSigla: funcaoSigla.trim() || null } })
    revalidar(atual.programacao.data)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao trocar a função.' }
  }
}

// ── Veículos, máquinas e avisos ──────────────────────────────────────────────

const esquemaRecurso = z.object({
  data: dataCalendario,
  frenteId: z.string().trim().min(1, 'Escolha a frente.'),
  tipo: z.enum([TIPO_RECURSO.VEICULO, TIPO_RECURSO.MAQUINA, TIPO_RECURSO.AVISO]),
  descricao: z.string().trim().min(2, 'Informe o que vai aparecer.'),
  placa: opcional,
  motoristaNome: opcional,
  veiculoLocalId: opcional,
  destaque: z.coerce.boolean().default(false),
})

export async function adicionarRecurso(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquemaRecurso.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  const d = parsed.data
  const data = diaUtc(d.data)

  try {
    const p = await prisma.programacao.upsert({ where: { data }, create: { data }, update: {} })
    const ultimo = await prisma.recurso.findFirst({
      where: { programacaoId: p.id, frenteId: d.frenteId },
      orderBy: { ordem: 'desc' }, select: { ordem: true },
    })

    const criado = await prisma.recurso.create({
      data: {
        programacaoId: p.id, frenteId: d.frenteId, tipo: d.tipo,
        descricao: d.descricao, placa: d.placa, motoristaNome: d.motoristaNome,
        veiculoLocalId: d.veiculoLocalId,
        destaque: d.destaque, ordem: (ultimo?.ordem ?? 0) + 1,
      },
    })
    revalidar(data)
    return { ok: true, dados: { id: criado.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao adicionar.' }
  }
}

export async function tirarRecurso(id: string): Promise<Resultado> {
  await exigirLancamento()
  try {
    const atual = await prisma.recurso.findUnique({
      where: { id }, include: { programacao: { select: { data: true } } },
    })
    if (!atual) return { ok: false, erro: 'Item não encontrado.' }
    await prisma.recurso.delete({ where: { id } })
    revalidar(atual.programacao.data)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao remover.' }
  }
}

// ── Publicação ───────────────────────────────────────────────────────────────

/**
 * Marca o dia como publicado.
 *
 * Não trava a edição depois: no canteiro alguém falta às 6h da manhã e a programação muda
 * com o dia já publicado. Travar faria a versão do sistema virar mentira, e o WhatsApp,
 * de novo, a fonte da verdade.
 */
export async function publicar(entrada: unknown): Promise<Resultado> {
  const sessao = await exigirLancamento()

  const parsed = z.object({ data: dataCalendario }).safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  const data = diaUtc(parsed.data.data)

  try {
    await prisma.programacao.update({
      where: { data },
      data: {
        status: STATUS_PROGRAMACAO.PUBLICADA,
        publicadaEm: new Date(),
        publicadaPor: sessao.nome,
      },
    })
    revalidar(data)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao publicar.' }
  }
}
