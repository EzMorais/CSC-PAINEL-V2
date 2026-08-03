'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { TIPO_PROGRAMACAO } from '@/lib/dominio/constantes'

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
  data: dataCalendario,
  tipo: z.enum([
    TIPO_PROGRAMACAO.ONIBUS, TIPO_PROGRAMACAO.LIMPEZA, TIPO_PROGRAMACAO.REFEICAO,
    TIPO_PROGRAMACAO.MANUTENCAO, TIPO_PROGRAMACAO.AVISO,
  ]),
  titulo: z.string().trim().min(3, 'Escreva o que vai acontecer.'),
  descricao: opcional,
  horario: opcional,
  responsavelNome: opcional,
  /** Vazio = aviso geral, vale para todos os alojamentos. */
  alojamentoId: opcional,
})

export async function criarProgramacao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const criada = await prisma.programacao.create({
      data: {
        data: d.data,
        tipo: d.tipo,
        titulo: d.titulo,
        descricao: d.descricao ?? null,
        horario: d.horario ?? null,
        responsavelNome: d.responsavelNome ?? null,
        alojamentoId: d.alojamentoId ?? null,
        criadoPor: sessao.nome,
      },
    })
    revalidarTelas('/', '/programacao')
    return { ok: true, dados: { id: criada.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao criar a programação.' }
  }
}

/**
 * Apagar de vez, sem histórico.
 *
 * Programação é quadro de avisos, não lançamento: um item errado de ontem não é registro
 * que alguém vá auditar, é ruído. Isto é diferente das alocações e dos pedidos, que
 * contam uma história e por isso só mudam de estado.
 */
export async function excluirProgramacao(id: string): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.programacao.delete({ where: { id } })
    revalidarTelas('/', '/programacao')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao excluir.' }
  }
}
