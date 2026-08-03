'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { geocodificar, mapaConfigurado } from '@/lib/geo'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const esquemaObra = z.object({
  codigo: z.string().trim().min(1, 'Informe o código da obra.'),
  cliente: z.string().trim().min(1, 'Informe o cliente.'),
  descricao: z.string().trim().min(1, 'Informe a descrição.'),
  endereco: opcional,
  cidade: opcional,
  uf: opcional,
})

/**
 * Cadastro local da obra, com endereço.
 *
 * O `codigo` tem de ser escrito igual ao dos outros módulos — é a chave natural que liga as
 * bases. O endereço só existe aqui: é o que permite medir a distância do alojamento até o
 * canteiro, e nenhum outro módulo precisa dele hoje.
 */
export async function criarObra(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquemaObra.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const linha = [d.endereco, [d.cidade, d.uf].filter(Boolean).join(' - ')].filter(Boolean).join(', ')
    const coordenada = linha && mapaConfigurado() ? await geocodificar(linha) : null

    const criada = await prisma.obra.create({
      data: {
        codigo: d.codigo,
        cliente: d.cliente,
        descricao: d.descricao,
        endereco: d.endereco ?? null,
        cidade: d.cidade ?? null,
        uf: d.uf ?? null,
        lat: coordenada?.ok ? coordenada.dados.lat : null,
        lng: coordenada?.ok ? coordenada.dados.lng : null,
      },
    })
    revalidarTelas('/obras')
    return { ok: true, dados: { id: criada.id } }
  } catch (e) {
    const msg =
      e instanceof Error && e.message.includes('Unique')
        ? 'Já existe uma obra com esse código.'
        : 'Falha ao criar a obra.'
    return { ok: false, erro: msg }
  }
}

export async function alternarAtivaObra(id: string, ativa: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.obra.update({ where: { id }, data: { ativa } })
    revalidarTelas('/obras')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar.' }
  }
}

const esquemaRota = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da rota.'),
  motorista: opcional,
  veiculo: opcional,
  horarioIda: opcional,
  horarioVolta: opcional,
  capacidade: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  obraCodigo: opcional,
  observacao: opcional,
})

export async function criarRota(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquemaRota.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const criada = await prisma.rotaOnibus.create({
      data: {
        nome: d.nome,
        motorista: d.motorista ?? null,
        veiculo: d.veiculo ?? null,
        horarioIda: d.horarioIda ?? null,
        horarioVolta: d.horarioVolta ?? null,
        capacidade: typeof d.capacidade === 'number' ? d.capacidade : null,
        obraCodigo: d.obraCodigo ?? null,
        observacao: d.observacao ?? null,
      },
    })
    revalidarTelas('/', '/rotas')
    return { ok: true, dados: { id: criada.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao criar a rota.' }
  }
}

export async function alternarAtivaRota(id: string, ativo: boolean): Promise<Resultado> {
  await exigirLancamento()
  try {
    await prisma.rotaOnibus.update({ where: { id }, data: { ativo } })
    revalidarTelas('/', '/rotas')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar.' }
  }
}
