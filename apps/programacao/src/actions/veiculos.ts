'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().nullish().transform((v) => (v ? v : null))

const esquema = z.object({
  modelo: z.string().trim().min(2, 'Informe o modelo.'),
  placa: opcional,
  motoristaNome: opcional,
  foto: opcional,
})

function revalidar() {
  revalidarTelas('/veiculos', '/')
}

export async function criarVeiculo(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  try {
    const criado = await prisma.veiculo.create({ data: parsed.data })
    revalidar()
    return { ok: true, dados: { id: criado.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao cadastrar o veículo.' }
  }
}

export async function editarVeiculo(id: string, entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  try {
    await prisma.veiculo.update({ where: { id }, data: parsed.data })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o veículo.' }
  }
}

export async function alternarAtivoVeiculo(id: string, ativo: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.veiculo.update({ where: { id }, data: { ativo } })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar o veículo.' }
  }
}

/** Apaga de vez — só serve para o cadastro criado por engano, que nunca entrou num dia. */
export async function apagarVeiculo(id: string): Promise<Resultado> {
  await exigirLancamento()

  try {
    const usos = await prisma.recurso.count({ where: { veiculoLocalId: id } })
    if (usos > 0) {
      return {
        ok: false,
        erro: `Este veículo já foi usado em ${usos} lançamentos. Desative em vez de apagar.`,
      }
    }
    await prisma.veiculo.delete({ where: { id } })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao apagar o veículo.' }
  }
}
