'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { SITUACAO_ITEM_AUDITORIA } from '@/lib/dominio/constantes'

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

const esquemaItem = z.object({
  descricao: z.string().trim().min(1, 'Todo item precisa de uma descrição.'),
  situacao: z.enum([SITUACAO_ITEM_AUDITORIA.CONFORME, SITUACAO_ITEM_AUDITORIA.NAO_CONFORME, SITUACAO_ITEM_AUDITORIA.NAO_SE_APLICA]),
  evidencia: opcional,
})

const esquema = z.object({
  titulo: z.string().trim().min(3, 'Descreva a auditoria.'),
  norma: opcional,
  obraId: opcional,
  realizadaEm: dataCalendario,
  responsavel: opcional,
  itens: z.array(esquemaItem).min(1, 'Adicione ao menos um item ao checklist.'),
})

export async function criarAuditoria(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const auditoria = await prisma.auditoria.create({
      data: {
        titulo: d.titulo,
        norma: d.norma ?? null,
        obraId: d.obraId ?? null,
        realizadaEm: d.realizadaEm,
        responsavel: d.responsavel ?? null,
        registradoPor: sessao.nome,
        itens: {
          create: d.itens.map((i) => ({
            descricao: i.descricao,
            situacao: i.situacao,
            evidencia: i.evidencia ?? null,
          })),
        },
      },
    })

    revalidarTelas('/', '/auditorias')
    return { ok: true, dados: { id: auditoria.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar a auditoria.' }
  }
}
