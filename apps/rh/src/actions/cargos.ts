'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { RISCO_CARGO } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cargo.'),
  cbo: opcional,
  risco: z.enum(RISCO_CARGO).default('NORMAL'),
})

/**
 * Cadastro rápido de cargo, usado direto do formulário de funcionário — atalho pra não
 * trocar de tela quando o cargo que falta é só mais um. A gestão completa (editar risco,
 * inativar) mora em Configurações.
 *
 * Sem `revalidatePath`: quem chama (o formulário de funcionário) já atualiza a lista de
 * cargos no cliente na hora (estado local, sem round-trip). Revalidar a mesma página aqui
 * duplicaria o cargo na tela — ele apareceria de novo vindo do servidor, ao lado do que o
 * cliente já adicionou.
 */
export async function criarCargo(entrada: unknown): Promise<Resultado<{ id: string; nome: string }>> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    const cargo = await prisma.cargo.create({
      data: { nome: parsed.data.nome, cbo: parsed.data.cbo ?? null, risco: parsed.data.risco },
    })
    return { ok: true, dados: { id: cargo.id, nome: cargo.nome } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Já existe um cargo com esse nome.' : 'Falha ao criar o cargo.'
    return { ok: false, erro: msg }
  }
}

const esquemaEdicao = z.object({
  risco: z.enum(RISCO_CARGO),
  ativo: z.coerce.boolean(),
})

/** Edição a partir de Configurações: só risco e ativo — nome/CBO não mudam depois de criado. */
export async function editarCargo(id: string, entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquemaEdicao.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    await prisma.cargo.update({ where: { id }, data: parsed.data })
    revalidarTelas('/configuracoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o cargo.' }
  }
}
