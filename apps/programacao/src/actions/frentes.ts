'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

/**
 * Campo opcional que aceita ausente, vazio E null.
 *
 * O `null` importa: a tela manda `campo || null` para dizer "não preencheu", e um esquema
 * que só aceita string recusa isso com "expected string, received null" — mensagem que não
 * diz nada a quem está preenchendo o formulário.
 */
const opcional = z.string().trim().nullish().transform((v) => (v ? v : null))

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cliente ou da frente.'),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor.'),
  logo: opcional,
  colunas: z.coerce.number().int().min(1).max(4).default(1),
  obraCodigo: opcional,
})

async function otimizarLogo(logo: string | null): Promise<string | null> {
  if (!logo) return null
  const separador = logo.indexOf(',')
  if (!logo.startsWith('data:') || separador < 0) throw new Error('A logo precisa ser uma imagem válida.')
  const bruto = Buffer.from(logo.slice(separador + 1), 'base64')
  if (bruto.length > 12 * 1024 * 1024) throw new Error('A logo deve ter no máximo 12 MB.')
  const { default: sharp } = await import('sharp')
  const webp = await sharp(bruto, { animated: false })
    .resize({ width: 640, height: 360, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer()
  return `data:image/webp;base64,${webp.toString('base64')}`
}

function revalidar() {
  revalidarTelas('/frentes', '/')
}

export async function criarFrente(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  try {
    const ultima = await prisma.frente.findFirst({ orderBy: { ordem: 'desc' }, select: { ordem: true } })
    const logo = await otimizarLogo(parsed.data.logo)
    const criada = await prisma.frente.create({
      data: { ...parsed.data, logo, ordem: (ultima?.ordem ?? 0) + 1 },
    })
    revalidar()
    return { ok: true, dados: { id: criada.id } }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `Já existe uma frente chamada "${parsed.data.nome}".`
      : 'Falha ao criar a frente.'
    return { ok: false, erro: msg }
  }
}

export async function editarFrente(id: string, entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }

  try {
    const logo = await otimizarLogo(parsed.data.logo)
    await prisma.frente.update({ where: { id }, data: { ...parsed.data, logo } })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes('Unique')
      ? `Já existe uma frente chamada "${parsed.data.nome}".`
      : 'Falha ao salvar a frente.'
    return { ok: false, erro: msg }
  }
}

/**
 * Desativa em vez de apagar quando a frente já apareceu em algum dia.
 *
 * Apagar levaria junto as escalas daquele dia — e a programação de uma terça passada
 * deixaria de dizer quem estava onde. Frente desativada some do quadro de amanhã e continua
 * nos dias antigos, que é exatamente o comportamento que se espera de um cliente que
 * terminou o contrato.
 */
export async function alternarFrente(id: string, ativa: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.frente.update({ where: { id }, data: { ativa } })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alterar a frente.' }
  }
}

/** Apaga de vez — só serve para a frente criada por engano, que nunca entrou num dia. */
export async function apagarFrente(id: string): Promise<Resultado> {
  await exigirLancamento()

  try {
    const usos = await prisma.escala.count({ where: { frenteId: id } })
    const recursos = await prisma.recurso.count({ where: { frenteId: id } })
    if (usos + recursos > 0) {
      return {
        ok: false,
        erro:
          `Esta frente já foi usada em ${usos + recursos} lançamentos. ` +
          'Desative em vez de apagar — apagar levaria junto a programação dos dias em que ela apareceu.',
      }
    }

    await prisma.frente.delete({ where: { id } })
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao apagar a frente.' }
  }
}

/** Sobe ou desce a frente — é a ordem em que as colunas saem na imagem. */
export async function moverFrente(id: string, direcao: 'cima' | 'baixo'): Promise<Resultado> {
  await exigirLancamento()

  try {
    const todas = await prisma.frente.findMany({ orderBy: { ordem: 'asc' } })
    const i = todas.findIndex((f) => f.id === id)
    if (i < 0) return { ok: false, erro: 'Frente não encontrada.' }

    const j = direcao === 'cima' ? i - 1 : i + 1
    if (j < 0 || j >= todas.length) return { ok: true, dados: undefined }

    // Troca as posições numa transação: sem ela, uma falha no meio deixaria duas frentes
    // com a mesma ordem e a imagem sairia com as colunas em ordem imprevisível.
    await prisma.$transaction([
      prisma.frente.update({ where: { id: todas[i].id }, data: { ordem: todas[j].ordem } }),
      prisma.frente.update({ where: { id: todas[j].id }, data: { ordem: todas[i].ordem } }),
    ])
    revalidar()
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao reordenar.' }
  }
}
