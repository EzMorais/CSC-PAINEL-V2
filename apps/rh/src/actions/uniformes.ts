'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { PECA_UNIFORME, MOTIVO_ENTREGA_UNIFORME } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

/** "" vira undefined: campo opcional em branco não deve gravar string vazia. */
const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

/** Data de calendário em meia-noite UTC — o mesmo referencial do resto do sistema. */
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
  peca: z.enum([PECA_UNIFORME.CAMISA, PECA_UNIFORME.CALCA, PECA_UNIFORME.CALCADO, PECA_UNIFORME.OUTRO]),
  tamanho: z.string().trim().min(1, 'Informe o tamanho.'),
  quantidade: z.coerce.number().int().positive('Quantidade deve ser maior que zero.').default(1),
  motivo: z.enum([
    MOTIVO_ENTREGA_UNIFORME.ADMISSAO,
    MOTIVO_ENTREGA_UNIFORME.REPOSICAO,
    MOTIVO_ENTREGA_UNIFORME.TROCA,
    MOTIVO_ENTREGA_UNIFORME.DANIFICADO,
  ]),
  entregueEm: dataCalendario,
  observacao: opcional,
  // Gerada pelo canvas de assinatura, não digitada — só confere presença.
  assinatura: z.string().trim().min(1, 'Colete a assinatura de recebimento.'),
})

export async function registrarEntrega(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: d.funcionarioId },
      select: { id: true },
    })
    if (!funcionario) return { ok: false, erro: 'Funcionário não encontrado.' }

    const entrega = await prisma.entregaUniforme.create({
      data: {
        funcionarioId: d.funcionarioId,
        peca: d.peca,
        tamanho: d.tamanho,
        quantidade: d.quantidade,
        motivo: d.motivo,
        entregueEm: d.entregueEm,
        observacao: d.observacao ?? null,
        assinatura: d.assinatura,
        registradoPor: sessao.nome,
      },
    })

    revalidarTelas('/', '/uniformes')
    return { ok: true, dados: { id: entrega.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar a entrega.' }
  }
}
