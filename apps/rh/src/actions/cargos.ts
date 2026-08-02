'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { RISCO_CARGO } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cargo.'),
  cbo: opcional,
  risco: z.enum(RISCO_CARGO).default('NORMAL'),
})

/**
 * Cadastro rápido de cargo, usado direto do formulário de funcionário — não existia
 * nenhuma tela pra isso, só o seed. Sem edição/inativação aqui de propósito: isso é
 * cadastro completo, escopo de Configurações (ainda não implementada); isto aqui só
 * resolve "preciso de um cargo que ainda não existe" sem trocar de tela.
 *
 * Sem `revalidatePath`: quem chama já atualiza a lista de cargos no cliente na hora
 * (estado local, sem round-trip). Revalidar a mesma página aqui duplicaria o cargo na
 * tela — ele apareceria de novo vindo do servidor, ao lado do que o cliente já adicionou.
 */
export async function criarCargo(entrada: unknown): Promise<Resultado<{ id: string; nome: string }>> {
  await exigirSessao()

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
