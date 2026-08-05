'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().nullish().transform((v) => (v ? v : null))

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  funcaoSigla: opcional,
  foto: opcional,
  motorista: z.coerce.boolean().default(false),
  tipo: z.enum(['CSC', 'PRESTADOR']).default('CSC'),
})

function revalidar() {
  revalidarTelas('/funcionarios', '/')
}

export async function criarFuncionario(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  try {
    const criado = await prisma.funcionario.create({ data: parsed.data })
    revalidar()
    return { ok: true, dados: { id: criado.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao cadastrar o funcionário.' }
  }
}

export async function editarFuncionario(id: string, entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  try {
    await prisma.funcionario.update({ where: { id }, data: parsed.data })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o funcionário.' }
  }
}

/** Ativo/inativo — quem saiu da empresa some da lista de "sem frente" sem apagar o histórico. */
export async function alternarAtivoFuncionario(id: string, ativo: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.funcionario.update({ where: { id }, data: { ativo } })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar o funcionário.' }
  }
}

/**
 * Ausente hoje (férias, atestado, folga) — diferente de inativo: continua na empresa, só não
 * entra em "sem frente" nem é copiado pro dia seguinte enquanto durar.
 */
export async function alternarAusencia(id: string, ausente: boolean, obs?: string): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.funcionario.update({
      where: { id },
      data: { ausente, ausenteObs: ausente ? (obs?.trim() || null) : null },
    })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar a ausência.' }
  }
}

/** Apaga de vez — só serve para o cadastro criado por engano, que nunca entrou num dia. */
export async function apagarFuncionario(id: string): Promise<Resultado> {
  await exigirLancamento()

  try {
    const usos = await prisma.escala.count({ where: { funcionarioLocalId: id } })
    if (usos > 0) {
      return {
        ok: false,
        erro: `Este funcionário já foi escalado ${usos} ${usos === 1 ? 'vez' : 'vezes'}. Desative em vez de apagar.`,
      }
    }
    await prisma.funcionario.delete({ where: { id } })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao apagar o funcionário.' }
  }
}
