'use server'

import { revalidarTelas } from '@/lib/revalidar'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do fornecedor.'),
  telefone: z.string().trim().optional(),
  aliases: z.string().trim().optional(),
})

export async function salvarFornecedor(id: string | null, entrada: unknown): Promise<Resultado> {
  await exigirSessao()
  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  const { nome, telefone, aliases } = parsed.data
  const listaAliases = (aliases ?? '')
    .split(',').map((a) => a.trim()).filter(Boolean)

  try {
    // Recusa apelido que já pertence a OUTRO fornecedor.
    //
    // O upsert abaixo, sozinho, reatribuiria silenciosamente o apelido em vez de falhar.
    // O estrago é real e difícil de perceber: digitar "MAQLOC" ao editar um fornecedor
    // qualquer faria toda importação futura dessa grafia cair no fornecedor errado, e o
    // gráfico "valor por fornecedor" passaria a mentir sem nenhum sinal.
    if (listaAliases.length) {
      const donos = await prisma.fornecedorAlias.findMany({
        where: { alias: { in: listaAliases }, ...(id ? { fornecedorId: { not: id } } : {}) },
        select: { alias: true, fornecedor: { select: { nome: true } } },
      })
      if (donos.length) {
        const lista = donos.map((d) => `"${d.alias}" (de ${d.fornecedor.nome})`).join(', ')
        return { ok: false, erro: `Estes apelidos já pertencem a outro fornecedor: ${lista}.` }
      }
    }

    // Em transação: sem isso, uma falha no meio deixaria o fornecedor sem nenhum apelido,
    // porque o deleteMany já teria rodado.
    await prisma.$transaction(async (tx) => {
      const fornecedor = id
        ? await tx.fornecedor.update({ where: { id }, data: { nome, telefone: telefone || null } })
        : await tx.fornecedor.create({ data: { nome, telefone: telefone || null } })

      await tx.fornecedorAlias.deleteMany({ where: { fornecedorId: fornecedor.id } })
      if (listaAliases.length) {
        await tx.fornecedorAlias.createMany({
          data: listaAliases.map((alias) => ({ alias, fornecedorId: fornecedor.id })),
        })
      }
    })

    revalidarTelas('/fornecedores', '/locacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `Já existe um fornecedor chamado ${nome}, ou um dos apelidos já pertence a outro.`
      : e instanceof Error ? e.message : 'Falha ao salvar o fornecedor'
    return { ok: false, erro: msg }
  }
}

export async function alternarFornecedor(id: string, ativo: boolean): Promise<Resultado> {
  await exigirSessao()
  try {
    await prisma.fornecedor.update({ where: { id }, data: { ativo } })
    revalidarTelas('/fornecedores')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar o fornecedor' }
  }
}

export async function listarFornecedores() {
  await exigirSessao()
  return prisma.fornecedor.findMany({
    orderBy: { nome: 'asc' },
    include: { aliases: { select: { alias: true } }, _count: { select: { locacoes: true } } },
  })
}
