'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { GRAVIDADE_NC, STATUS_NC } from '@/lib/dominio/constantes'

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

const esquema = z.object({
  titulo: z.string().trim().min(3, 'Descreva a não conformidade.'),
  descricao: z.string().trim().min(3, 'Descreva o que foi encontrado.'),
  gravidade: z.enum([GRAVIDADE_NC.BAIXA, GRAVIDADE_NC.MEDIA, GRAVIDADE_NC.ALTA]),
  responsavel: opcional,
  prazo: z.union([dataCalendario, z.literal('')]).optional(),
  evidenciaAntes: opcional,
  auditoriaItemId: opcional,
})

/** Nasce solta ou a partir de um item de auditoria reprovado — `auditoriaItemId` é o que diferencia. */
export async function criarNaoConformidade(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const nc = await prisma.naoConformidade.create({
      data: {
        titulo: d.titulo,
        descricao: d.descricao,
        gravidade: d.gravidade,
        responsavel: d.responsavel ?? null,
        prazo: d.prazo instanceof Date ? d.prazo : null,
        evidenciaAntes: d.evidenciaAntes ?? null,
        auditoriaItemId: d.auditoriaItemId ?? null,
        registradoPor: sessao.nome,
      },
    })

    revalidarTelas('/nao-conformidades', '/auditorias')
    return { ok: true, dados: { id: nc.id } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? 'Esse item de auditoria já tem uma não conformidade aberta.'
      : 'Falha ao registrar a não conformidade.'
    return { ok: false, erro: msg }
  }
}

const esquemaStatus = z.object({
  status: z.enum([STATUS_NC.ABERTA, STATUS_NC.EM_ANDAMENTO, STATUS_NC.RESOLVIDA]),
  evidenciaDepois: opcional,
})

export async function atualizarStatusNaoConformidade(id: string, entrada: unknown): Promise<Resultado> {
  await exigirSessao()

  const parsed = esquemaStatus.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    await prisma.naoConformidade.update({
      where: { id },
      data: {
        status: d.status,
        evidenciaDepois: d.evidenciaDepois ?? undefined,
        resolvidoEm: d.status === STATUS_NC.RESOLVIDA ? new Date() : null,
      },
    })
    revalidarTelas('/nao-conformidades')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao atualizar.' }
  }
}
