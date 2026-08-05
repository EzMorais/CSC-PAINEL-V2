'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const esquemaNova = z.object({
  sigla: z.string().trim().min(1, 'Informe a sigla.').max(12, 'Sigla curta demais para caber no crachá.'),
  nome: z.string().trim().min(2, 'Informe o nome da função.'),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor.'),
})

/**
 * Cria uma função nova direto do formulário de funcionário — não existe tela própria de
 * "Funções" porque cadastrar sempre acontece junto de cadastrar alguém: ninguém cria uma
 * sigla nova sem ter em mente a primeira pessoa que vai usá-la.
 */
export async function criarFuncao(entrada: unknown): Promise<Resultado<{ sigla: string; nome: string; cor: string }>> {
  await exigirLancamento()

  const parsed = esquemaNova.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  const sigla = parsed.data.sigla.toUpperCase()

  try {
    const ultima = await prisma.funcao.findFirst({ orderBy: { ordem: 'desc' }, select: { ordem: true } })
    const criada = await prisma.funcao.create({
      data: { sigla, nome: parsed.data.nome, cor: parsed.data.cor, ordem: (ultima?.ordem ?? 0) + 1 },
    })
    revalidarTelas('/funcionarios', '/')
    return { ok: true, dados: { sigla: criada.sigla, nome: criada.nome, cor: criada.cor } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `Já existe uma função com a sigla "${sigla}".`
      : 'Falha ao criar a função.'
    return { ok: false, erro: msg }
  }
}

/**
 * Muda a cor de uma sigla existente — pinta todo mundo que já tem essa função, não só quem
 * está sendo editado no momento. É o "cadastro de cores" morando dentro do formulário de
 * funcionário, em vez de numa tela separada que ninguém lembraria de abrir.
 */
export async function editarCorFuncao(sigla: string, cor: string): Promise<Resultado> {
  await exigirLancamento()

  const parsed = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor.').safeParse(cor)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  try {
    await prisma.funcao.update({ where: { sigla }, data: { cor: parsed.data } })
    revalidarTelas('/funcionarios', '/')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao mudar a cor.' }
  }
}
