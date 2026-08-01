'use server'

import { revalidarTelas } from '@/lib/revalidar'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const esquema = z.object({
  cliente: z.string().trim().min(2, 'Informe o cliente.'),
  codigo: z.string().trim().min(2, 'Informe o código da obra.'),
  descricao: z.string().trim().min(2, 'Informe a descrição.'),
  responsavel: z.string().trim().optional(),
})

export async function salvarObra(id: string | null, entrada: unknown): Promise<Resultado> {
  await exigirSessao()
  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  const d = { ...parsed.data, responsavel: parsed.data.responsavel || null }

  try {
    if (id) {
      await prisma.obra.update({ where: { id }, data: d })
    } else {
      await prisma.obra.create({ data: { ...d, abaOrigem: d.codigo } })
    }
    revalidarTelas('/obras', '/locacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `Já existe uma obra com o código ${d.codigo}.`
      : e instanceof Error ? e.message : 'Falha ao salvar a obra'
    return { ok: false, erro: msg }
  }
}

export async function alternarObra(id: string, ativa: boolean): Promise<Resultado> {
  await exigirSessao()
  try {
    if (!ativa) {
      const emUso = await prisma.locacao.count({ where: { obraId: id, devolvidaEm: null } })
      if (emUso > 0) {
        return { ok: false, erro: `Esta obra tem ${emUso} locações em aberto. Devolva ou transfira antes de desativar.` }
      }
    }
    await prisma.obra.update({ where: { id }, data: { ativa } })
    revalidarTelas('/obras')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar a obra' }
  }
}

export async function listarObras() {
  await exigirSessao()
  return prisma.obra.findMany({
    orderBy: [{ cliente: 'asc' }, { codigo: 'asc' }],
    include: { _count: { select: { locacoes: true } } },
  })
}
