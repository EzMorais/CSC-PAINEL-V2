'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { CATEGORIA_DOCUMENTO_EMPRESA, CATEGORIA_DOCUMENTO_PESSOAL, ROTULO_CATEGORIA_DOCUMENTO_PESSOAL } from '@/lib/dominio/constantes'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

const dataCalendario = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .transform((v) => {
    const [a, m, d] = v.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, d))
  })

const categoriasEmpresa = Object.values(CATEGORIA_DOCUMENTO_EMPRESA) as [string, ...string[]]
const categoriasPessoal = Object.values(CATEGORIA_DOCUMENTO_PESSOAL) as [string, ...string[]]

const esquemaEmpresa = z.object({
  categoria: z.enum(categoriasEmpresa),
  titulo: z.string().trim().min(2, 'Informe o título.'),
  obraId: opcional,
  vigenteDesde: z.union([dataCalendario, z.literal('')]).optional(),
  validoAte: z.union([dataCalendario, z.literal('')]).optional(),
  observacao: opcional,
  arquivo: opcional,
})

/** Reenviar o mesmo título+categoria(+obra) cria uma versão nova — a antiga não é apagada. */
export async function registrarDocumentoEmpresa(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirSessao()

  const parsed = esquemaEmpresa.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const versoesAnteriores = await prisma.documento.count({
      where: { categoria: d.categoria, titulo: d.titulo, obraId: d.obraId ?? null, funcionarioId: null },
    })

    const doc = await prisma.documento.create({
      data: {
        categoria: d.categoria,
        titulo: d.titulo,
        versao: versoesAnteriores + 1,
        obraId: d.obraId ?? null,
        vigenteDesde: d.vigenteDesde instanceof Date ? d.vigenteDesde : null,
        validoAte: d.validoAte instanceof Date ? d.validoAte : null,
        observacao: d.observacao ?? null,
        arquivo: d.arquivo ?? null,
        registradoPor: sessao.nome,
      },
    })

    revalidarTelas('/documentos')
    return { ok: true, dados: { id: doc.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar o documento.' }
  }
}

const esquemaPessoal = z.object({
  funcionarioId: z.string().trim().min(1, 'Selecione o funcionário.'),
  categoria: z.enum(categoriasPessoal),
  arquivo: z.string().trim().min(1, 'Selecione um arquivo.'),
})

/** Um item do checklist de admissão — o título vem da própria categoria, não é digitado. */
export async function registrarDocumentoPessoal(entrada: unknown): Promise<Resultado> {
  const sessao = await exigirSessao()

  const parsed = esquemaPessoal.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const versoesAnteriores = await prisma.documento.count({
      where: { funcionarioId: d.funcionarioId, categoria: d.categoria },
    })

    await prisma.documento.create({
      data: {
        categoria: d.categoria,
        titulo: ROTULO_CATEGORIA_DOCUMENTO_PESSOAL[d.categoria as keyof typeof ROTULO_CATEGORIA_DOCUMENTO_PESSOAL],
        versao: versoesAnteriores + 1,
        funcionarioId: d.funcionarioId,
        arquivo: d.arquivo,
        registradoPor: sessao.nome,
      },
    })

    revalidarTelas('/documentos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao anexar o documento.' }
  }
}
