import { prisma } from '@/lib/prisma'
import { STATUS } from '@/lib/dominio/constantes'

export type FiltrosDocumentoEmpresa = { busca?: string; categoria?: string }

/** Documentos da empresa/obra — `funcionarioId` nulo é o que separa dos pessoais. */
export async function listarDocumentosEmpresa(filtros: FiltrosDocumentoEmpresa = {}) {
  const { busca, categoria } = filtros
  const termo = busca?.trim()

  return prisma.documento.findMany({
    where: {
      funcionarioId: null,
      ...(categoria ? { categoria } : {}),
      ...(termo ? { titulo: { contains: termo } } : {}),
    },
    orderBy: [{ titulo: 'asc' }, { versao: 'desc' }],
    include: { obra: { select: { codigo: true, descricao: true } } },
  })
}

export type DocumentoEmpresaListado = Awaited<ReturnType<typeof listarDocumentosEmpresa>>[number]

export async function obrasParaSelecao() {
  return prisma.obra.findMany({
    where: { ativa: true },
    orderBy: { codigo: 'asc' },
    select: { id: true, codigo: true, descricao: true },
  })
}

export type ObraParaSelecao = Awaited<ReturnType<typeof obrasParaSelecao>>[number]

export async function contarDocumentosVencendo(dias = 30) {
  const hoje = new Date()
  const limite = new Date(hoje.getTime() + dias * 86_400_000)
  const docs = await prisma.documento.findMany({
    where: { funcionarioId: null, validoAte: { lte: limite, not: null } },
    select: { validoAte: true },
  })
  const vencidos = docs.filter((d) => d.validoAte && d.validoAte < hoje).length
  return { vencidos, vencendo: docs.length - vencidos }
}

// ── documentos pessoais (checklist de admissão) ──────────────────────────────

export async function funcionariosParaDocumento() {
  return prisma.funcionario.findMany({
    where: { status: { not: STATUS.DESLIGADO } },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, matricula: true },
  })
}

export type FuncionarioParaDocumento = Awaited<ReturnType<typeof funcionariosParaDocumento>>[number]

/** Última versão de cada categoria pessoal enviada por esse funcionário — a base do checklist. */
export async function documentosPessoaisDoFuncionario(funcionarioId: string) {
  const docs = await prisma.documento.findMany({
    where: { funcionarioId },
    orderBy: { criadoEm: 'desc' },
  })
  const porCategoria = new Map<string, (typeof docs)[number]>()
  for (const d of docs) {
    if (!porCategoria.has(d.categoria)) porCategoria.set(d.categoria, d)
  }
  return porCategoria
}
