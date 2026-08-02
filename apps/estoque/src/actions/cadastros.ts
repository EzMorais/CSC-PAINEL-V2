'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const esquemaFornecedor = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do fornecedor.'),
  cnpj: opcional,
  telefone: opcional,
  email: z.union([z.string().trim().email('E-mail inválido.'), z.literal('')]).optional(),
})

export async function criarFornecedor(entrada: unknown): Promise<Resultado<{ id: string; nome: string }>> {
  await exigirLancamento()

  const parsed = esquemaFornecedor.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const fornecedor = await prisma.fornecedor.create({
      data: {
        nome: d.nome,
        cnpj: d.cnpj ?? null,
        telefone: d.telefone ?? null,
        email: d.email || null,
      },
    })
    revalidarTelas('/fornecedores', '/movimentacoes')
    return { ok: true, dados: { id: fornecedor.id, nome: fornecedor.nome } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? 'Já existe um fornecedor com esse nome.'
      : 'Falha ao cadastrar o fornecedor.'
    return { ok: false, erro: msg }
  }
}

export async function alternarAtivoFornecedor(id: string, ativo: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.fornecedor.update({ where: { id }, data: { ativo } })
    revalidarTelas('/fornecedores')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar o fornecedor.' }
  }
}

const esquemaObra = z.object({
  codigo: z.string().trim().min(1, 'Informe o código da obra.'),
  cliente: z.string().trim().min(2, 'Informe o cliente.'),
  descricao: z.string().trim().min(2, 'Informe a descrição da obra.'),
  responsavel: opcional,
})

/**
 * Cadastro de obra dentro do almoxarifado.
 *
 * A obra "de verdade" nasce no Painel de Locação; aqui ela é um espelho, casado por
 * `codigo`. Este cadastro existe porque os bancos são separados e ainda não há
 * sincronização automática — sem ele, uma obra nova bloquearia toda saída de material até
 * alguém mexer no banco à mão. Use o MESMO código do painel, senão os dois lados deixam de
 * se reconhecer quando a sincronização existir.
 */
export async function criarObra(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquemaObra.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const obra = await prisma.obra.create({
      data: {
        codigo: d.codigo.toUpperCase(),
        cliente: d.cliente.toUpperCase(),
        descricao: d.descricao.toUpperCase(),
        responsavel: d.responsavel ?? null,
      },
    })
    revalidarTelas('/', '/obras', '/movimentacoes')
    return { ok: true, dados: { id: obra.id } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? 'Já existe uma obra com esse código.'
      : 'Falha ao cadastrar a obra.'
    return { ok: false, erro: msg }
  }
}

export async function alternarAtivaObra(id: string, ativa: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.obra.update({ where: { id }, data: { ativa } })
    revalidarTelas('/', '/obras')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar a obra.' }
  }
}
