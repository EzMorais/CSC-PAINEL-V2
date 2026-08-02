'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { CATEGORIA_MATERIAL, UNIDADE } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const categorias = Object.values(CATEGORIA_MATERIAL) as [string, ...string[]]
const unidades = [...UNIDADE] as [string, ...string[]]

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do material.'),
  categoria: z.enum(categorias),
  unidade: z.enum(unidades),
  estoqueMinimo: z.union([z.coerce.number().nonnegative('Mínimo não pode ser negativo.'), z.literal('')]).optional(),
  localizacao: opcional,
  observacao: opcional,
})

function paraBanco(d: z.infer<typeof esquema>) {
  return {
    nome: d.nome,
    categoria: d.categoria,
    unidade: d.unidade,
    estoqueMinimo: typeof d.estoqueMinimo === 'number' ? d.estoqueMinimo : 0,
    localizacao: d.localizacao ?? null,
    observacao: d.observacao ?? null,
  }
}

function mensagem(e: unknown, padrao: string): string {
  if (e instanceof Error && e.message.includes('Unique')) {
    return 'Já existe um material com esse código. Recarregue a página e tente de novo.'
  }
  return e instanceof Error ? e.message : padrao
}

export async function criarMaterial(entrada: unknown, codigo: string): Promise<Resultado<{ id: string }>> {
  await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    const material = await prisma.material.create({ data: { ...paraBanco(parsed.data), codigo } })
    revalidarTelas('/', '/materiais')
    return { ok: true, dados: { id: material.id } }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao cadastrar o material.') }
  }
}

export async function editarMaterial(id: string, entrada: unknown): Promise<Resultado> {
  await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    await prisma.material.update({ where: { id }, data: paraBanco(parsed.data) })
    revalidarTelas('/', '/materiais', `/materiais/${id}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao salvar o material.') }
  }
}

/**
 * Inativa em vez de excluir.
 *
 * As movimentações antigas apontam para o material; apagá-lo levaria o histórico junto
 * (`onDelete: Cascade`) e o extrato de uma obra passaria a mentir sobre o que ela recebeu.
 * Inativar tira o item das listas de lançamento sem tocar no passado.
 */
export async function alternarAtivoMaterial(id: string, ativo: boolean): Promise<Resultado> {
  await exigirSessao()
  try {
    await prisma.material.update({ where: { id }, data: { ativo } })
    revalidarTelas('/', '/materiais', `/materiais/${id}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar o material.' }
  }
}
