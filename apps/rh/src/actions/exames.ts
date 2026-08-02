'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { TIPO_EXAME, RESULTADO_EXAME } from '@/lib/dominio/constantes'

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
  funcionarioId: z.string().trim().min(1, 'Selecione o funcionário.'),
  tipo: z.enum([
    TIPO_EXAME.ADMISSIONAL, TIPO_EXAME.PERIODICO, TIPO_EXAME.RETORNO_TRABALHO,
    TIPO_EXAME.DEMISSIONAL, TIPO_EXAME.MUDANCA_FUNCAO,
  ]),
  realizadoEm: dataCalendario,
  validadeEm: z.union([dataCalendario, z.literal('')]).optional(),
  resultado: z.enum([RESULTADO_EXAME.APTO, RESULTADO_EXAME.INAPTO, RESULTADO_EXAME.APTO_COM_RESTRICAO]),
  restricoes: opcional,
  arquivo: opcional,
})

export async function registrarExame(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const funcionario = await prisma.funcionario.findUnique({ where: { id: d.funcionarioId }, select: { id: true } })
    if (!funcionario) return { ok: false, erro: 'Funcionário não encontrado.' }

    const exame = await prisma.exame.create({
      data: {
        funcionarioId: d.funcionarioId,
        tipo: d.tipo,
        realizadoEm: d.realizadoEm,
        validadeEm: d.validadeEm instanceof Date ? d.validadeEm : null,
        resultado: d.resultado,
        restricoes: d.restricoes ?? null,
        arquivo: d.arquivo ?? null,
        registradoPor: sessao.nome,
      },
    })

    revalidarTelas('/', '/exames')
    return { ok: true, dados: { id: exame.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar o exame.' }
  }
}
