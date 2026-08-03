'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do setor.'),
  paiId: z.string().trim().min(1, 'Escolha se o setor é do Administrativo ou da Engenharia.'),
})

/**
 * Cadastro rápido de setor, chamado do próprio formulário de funcionário — mesmo atalho do
 * cargo, para não trocar de tela quando falta só mais um setor.
 *
 * Trava o organograma em dois níveis: o pai escolhido tem de ser um ramo (sem pai). Sem
 * isto, um setor pendurado em outro setor entraria calado e a lista da tela — que agrupa
 * por ramo — simplesmente deixaria de mostrar ele, sem erro nenhum apontando a causa.
 */
export async function criarDepartamento(
  entrada: unknown,
): Promise<Resultado<{ id: string; nome: string; paiId: string }>> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    const pai = await prisma.departamento.findUnique({
      where: { id: parsed.data.paiId },
      select: { id: true, paiId: true },
    })
    if (!pai) return { ok: false, erro: 'Ramo não encontrado.' }
    if (pai.paiId) {
      return { ok: false, erro: 'O organograma tem só dois níveis: escolha Administrativo ou Engenharia.' }
    }

    const criado = await prisma.departamento.create({
      data: { nome: parsed.data.nome, paiId: pai.id },
    })
    return { ok: true, dados: { id: criado.id, nome: criado.nome, paiId: pai.id } }
  } catch (e) {
    const msg =
      e instanceof Error && e.message.includes('Unique')
        ? 'Já existe um setor com esse nome.'
        : 'Falha ao criar o setor.'
    return { ok: false, erro: msg }
  }
}

/** Ativa/inativa a partir de Configurações. Nome e ramo não mudam depois de criados. */
export async function alternarAtivoDepartamento(id: string, ativo: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.departamento.update({ where: { id }, data: { ativo } })
    revalidarTelas('/configuracoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o setor.' }
  }
}
