'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao, temAcesso } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { podeLancar, MODULO } from '@/lib/dominio/cargos'
import { CONFIG_TIPO } from '@/lib/dominio/cadastros'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const tipos = Object.keys(CONFIG_TIPO) as [string, ...string[]]

const texto = z.string().trim().optional().transform((v) => (v ? v : null))

const esquema = z.object({
  tipo: z.enum(tipos),
  codigo: z.string().trim().min(1, 'Informe o código.'),
  nome: z.string().trim().min(2, 'Informe o nome.'),
  detalhe: texto,
  identificador: texto,
  local: texto,
  unidade: texto,
  // Campo numérico vazio chega como '' do formulário; `coerce` transformaria em 0, e um
  // estoque mínimo "0" que ninguém digitou é diferente de "não informado".
  quantidade: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null
      const n = Number(String(v).replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }),
  observacao: texto,
})

/**
 * Piso de toda escrita no catálogo.
 *
 * Duas checagens, não uma: ter o módulo liberado diz ONDE a pessoa entra, o cargo diz o QUE
 * ela pode fazer. Sem a segunda, o cargo Consulta seria só um rótulo — as Server Actions
 * continuariam alcançáveis por quem chamasse o endereço direto.
 */
async function exigirEscrita() {
  const sessao = await exigirSessao()
  if (!temAcesso(sessao, MODULO.CADASTROS)) {
    throw new Error('Você não tem acesso ao módulo de Cadastros.')
  }
  if (!podeLancar(sessao.cargo)) {
    throw new Error('Seu cargo permite apenas consultar. Peça ao administrador para alterar.')
  }
  return sessao
}

export async function salvarItem(id: string | null, entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirEscrita()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const item = id
      ? await prisma.itemCadastro.update({ where: { id }, data: d })
      : await prisma.itemCadastro.create({ data: d })

    revalidarTelas('/cadastros')
    return { ok: true, dados: { id: item.id } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `Já existe um item deste tipo com o código "${d.codigo}".`
      : 'Falha ao salvar o item.'
    return { ok: false, erro: msg }
  }
}

/**
 * Desativa em vez de apagar.
 *
 * Um material removido some do catálogo mas continua citado em pedido antigo e em conversa
 * de obra; apagar transformaria a pergunta "que material era o 042?" numa resposta que o
 * sistema não tem mais. Desativado sai das listas de uso e continua achável.
 */
export async function alternarAtivo(id: string, ativo: boolean): Promise<Resultado> {
  await exigirEscrita()

  try {
    await prisma.itemCadastro.update({ where: { id }, data: { ativo } })
    revalidarTelas('/cadastros')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar a situação.' }
  }
}
