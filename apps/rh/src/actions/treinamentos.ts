'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { NORMA_TREINAMENTO } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const dataCalendario = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .transform((v) => {
    const [a, m, d] = v.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, d))
  })

const esquemaTurma = z.object({
  norma: z.enum([
    NORMA_TREINAMENTO.NR_10,
    NORMA_TREINAMENTO.NR_18,
    NORMA_TREINAMENTO.NR_33,
    NORMA_TREINAMENTO.NR_35,
    NORMA_TREINAMENTO.OUTRA,
  ]),
  descricao: z.string().trim().min(3, 'Descreva a turma.'),
  instrutor: opcional,
  cargaHoraria: z.union([z.coerce.number().int().positive('Carga horária deve ser maior que zero.'), z.literal('')]).optional(),
  realizadoEm: dataCalendario,
  validadeEm: z.union([dataCalendario, z.literal('')]).optional(),
  funcionarioIds: z.array(z.string().trim().min(1)).min(1, 'Selecione ao menos um funcionário.'),
})

export async function criarTurma(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirLancamento()

  const parsed = esquemaTurma.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const turma = await prisma.treinamento.create({
      data: {
        norma: d.norma,
        descricao: d.descricao,
        instrutor: d.instrutor ?? null,
        cargaHoraria: typeof d.cargaHoraria === 'number' ? d.cargaHoraria : null,
        realizadoEm: d.realizadoEm,
        validadeEm: d.validadeEm instanceof Date ? d.validadeEm : null,
        registradoPor: sessao.nome,
        participantes: {
          create: d.funcionarioIds.map((funcionarioId) => ({ funcionarioId })),
        },
      },
    })

    revalidarTelas('/', '/treinamentos')
    return { ok: true, dados: { id: turma.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao criar a turma.' }
  }
}

const esquemaParticipante = z.object({
  treinamentoId: z.string().trim().min(1),
  funcionarioId: z.string().trim().min(1, 'Selecione um funcionário.'),
})

/** Matrícula avulsa numa turma que já existe — pra quem ficou de fora na criação. */
export async function adicionarParticipante(entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquemaParticipante.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    await prisma.treinamentoParticipante.create({ data: parsed.data })
    revalidarTelas(`/treinamentos/${parsed.data.treinamentoId}`, '/treinamentos')
    return { ok: true, dados: undefined }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Esse funcionário já está nessa turma.' : 'Falha ao adicionar o participante.'
    return { ok: false, erro: msg }
  }
}

/**
 * Só remove quem ainda não tem certificado anexado — depois disso vira histórico, não
 * matrícula por engano, e apagar destruiria um documento já enviado.
 */
export async function removerParticipante(participanteId: string): Promise<Resultado> {
  await exigirLancamento()

  try {
    const participante = await prisma.treinamentoParticipante.findUnique({
      where: { id: participanteId },
      select: { certificado: true, treinamentoId: true },
    })
    if (!participante) return { ok: false, erro: 'Participante não encontrado.' }
    if (participante.certificado) return { ok: false, erro: 'Já tem certificado anexado — não dá para remover.' }

    await prisma.treinamentoParticipante.delete({ where: { id: participanteId } })
    revalidarTelas(`/treinamentos/${participante.treinamentoId}`, '/treinamentos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao remover o participante.' }
  }
}

const esquemaCertificado = z.object({
  participanteId: z.string().trim().min(1),
  certificado: z.string().trim().min(1, 'Selecione um arquivo.'),
})

/** Certificado é anexado por participante, depois que a turma já existe — não faz parte da criação. */
export async function anexarCertificado(entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquemaCertificado.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    await prisma.treinamentoParticipante.update({
      where: { id: parsed.data.participanteId },
      data: { certificado: parsed.data.certificado },
    })
    revalidarTelas('/treinamentos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao anexar o certificado.' }
  }
}
