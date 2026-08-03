'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { geocodificar, mapaConfigurado } from '@/lib/geo'
import { TIPO_QUARTO } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const esquemaAlojamento = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do alojamento.'),
  cep: opcional,
  logradouro: opcional,
  numero: opcional,
  complemento: opcional,
  bairro: opcional,
  cidade: opcional,
  uf: opcional,
  capacidadeTotal: z.union([z.coerce.number().int().nonnegative(), z.literal('')]).optional(),
  responsavelNome: opcional,
  telefoneResponsavel: opcional,
  foto: z
    .union([z.string().trim().startsWith('data:image/', 'Foto inválida — envie uma imagem.'), z.literal('')])
    .optional(),
  observacoes: opcional,
})

/** Junta os pedaços do endereço numa linha só, do jeito que o Google entende melhor. */
function enderecoCompleto(d: z.infer<typeof esquemaAlojamento>): string | null {
  const partes = [
    [d.logradouro, d.numero].filter(Boolean).join(', '),
    d.bairro,
    [d.cidade, d.uf].filter(Boolean).join(' - '),
    d.cep,
  ].filter((p) => p && p.length > 0)
  return partes.length > 0 ? partes.join(', ') : null
}

function paraBanco(d: z.infer<typeof esquemaAlojamento>) {
  return {
    nome: d.nome,
    cep: d.cep ?? null,
    logradouro: d.logradouro ?? null,
    numero: d.numero ?? null,
    complemento: d.complemento ?? null,
    bairro: d.bairro ?? null,
    cidade: d.cidade ?? null,
    uf: d.uf ?? null,
    capacidadeTotal: typeof d.capacidadeTotal === 'number' ? d.capacidadeTotal : null,
    responsavelNome: d.responsavelNome ?? null,
    telefoneResponsavel: d.telefoneResponsavel ?? null,
    foto: d.foto || null,
    observacoes: d.observacoes ?? null,
  }
}

/**
 * Tenta achar a coordenada, mas nunca derruba o salvamento por causa disso.
 *
 * Sem chave do Google, ou com o endereço escrito de um jeito que ele não reconhece, o
 * alojamento é gravado igual — só fica sem ponto no mapa. Cadastro que só aceita endereço
 * geocodificável é cadastro que trava na hora do aperto.
 */
async function tentarCoordenada(endereco: string | null): Promise<{ lat: number | null; lng: number | null }> {
  if (!endereco || !mapaConfigurado()) return { lat: null, lng: null }
  const r = await geocodificar(endereco)
  return r.ok ? r.dados : { lat: null, lng: null }
}

export async function criarAlojamento(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquemaAlojamento.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    const coordenada = await tentarCoordenada(enderecoCompleto(parsed.data))
    const criado = await prisma.alojamento.create({
      data: { ...paraBanco(parsed.data), ...coordenada },
    })
    revalidarTelas('/', '/alojamentos')
    return { ok: true, dados: { id: criado.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao criar o alojamento.' }
  }
}

export async function editarAlojamento(id: string, entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquemaAlojamento.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    const coordenada = await tentarCoordenada(enderecoCompleto(parsed.data))
    await prisma.alojamento.update({ where: { id }, data: { ...paraBanco(parsed.data), ...coordenada } })
    revalidarTelas('/', '/alojamentos', `/alojamentos/${id}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o alojamento.' }
  }
}

export async function alternarAtivoAlojamento(id: string, ativo: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.alojamento.update({ where: { id }, data: { ativo } })
    revalidarTelas('/', '/alojamentos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar.' }
  }
}

const esquemaQuarto = z.object({
  alojamentoId: z.string().trim().min(1, 'Alojamento não informado.'),
  numero: z.string().trim().min(1, 'Informe o número ou nome do quarto.'),
  capacidade: z.coerce.number().int().positive('A capacidade tem de ser pelo menos 1.'),
  tipo: z.union([z.enum([TIPO_QUARTO.MASCULINO, TIPO_QUARTO.FEMININO, TIPO_QUARTO.MISTO]), z.literal('')]).optional(),
  observacoes: opcional,
})

export async function criarQuarto(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquemaQuarto.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const criado = await prisma.quarto.create({
      data: {
        alojamentoId: d.alojamentoId,
        numero: d.numero,
        capacidade: d.capacidade,
        tipo: d.tipo || null,
        observacoes: d.observacoes ?? null,
      },
    })
    revalidarTelas('/', '/alojamentos', `/alojamentos/${d.alojamentoId}`)
    return { ok: true, dados: { id: criado.id } }
  } catch (e) {
    const msg =
      e instanceof Error && e.message.includes('Unique')
        ? 'Já existe um quarto com esse número neste alojamento.'
        : 'Falha ao criar o quarto.'
    return { ok: false, erro: msg }
  }
}

/**
 * Inativar quarto não expulsa ninguém: quem já está lá continua lá.
 *
 * O quarto some das opções de novas alocações, e é só isso que "inativo" quer dizer aqui —
 * encerrar as alocações junto apagaria da noite para o dia o registro de onde as pessoas
 * dormem, que é exatamente o que este módulo existe para saber.
 */
export async function alternarAtivoQuarto(id: string, ativo: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    const quarto = await prisma.quarto.update({ where: { id }, data: { ativo } })
    revalidarTelas('/', '/alojamentos', `/alojamentos/${quarto.alojamentoId}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o quarto.' }
  }
}
