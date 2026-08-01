import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DIAS_ATENCAO, STATUS } from '@/lib/dominio/constantes'
import { limiteEmDias } from '@/lib/dominio/status'

export type FiltrosLocacao = {
  busca?: string
  obraId?: string
  fornecedorId?: string
  status?: string
  estado?: string
  aConfirmar?: boolean
}

/**
 * Os limites vêm de `limiteEmDias`, não de `startOfDay`: `dataFim` está gravada como
 * meia-noite UTC representando um dia de calendário, e um limiar em meia-noite local
 * cairia 3h depois no Brasil — o filtro discordaria da etiqueta que a tabela exibe.
 */
function clausulaStatus(status: string | undefined, hoje: Date): Prisma.LocacaoWhereInput {
  const inicioHoje = limiteEmDias(0, hoje)
  const limiteAtencao = limiteEmDias(DIAS_ATENCAO, hoje)
  switch (status) {
    case STATUS.DEVOLVIDA:
      return { devolvidaEm: { not: null } }
    case STATUS.VENCIDA:
      return { devolvidaEm: null, dataFim: { lt: inicioHoje } }
    case STATUS.ATENCAO:
      return { devolvidaEm: null, dataFim: { gte: inicioHoje, lte: limiteAtencao } }
    case STATUS.ATIVA:
      return { devolvidaEm: null, dataFim: { gt: limiteAtencao } }
    case STATUS.SEM_PRAZO:
      return { devolvidaEm: null, dataFim: null }
    // Sem nenhum recorte por situação — inclui devolvidas. Necessário para que o cartão
    // "Itens perdidos" do dashboard leve a uma lista com os 16, e não com os 12 em aberto:
    // 4 equipamentos foram perdidos e a locação depois encerrada, e o número exibido no
    // cartão precisa bater com o que aparece ao clicar nele.
    case 'TODAS':
      return {}
    default:
      return { devolvidaEm: null }
  }
}

export async function listarLocacoes(filtros: FiltrosLocacao, hoje = new Date()) {
  const where: Prisma.LocacaoWhereInput = { ...clausulaStatus(filtros.status, hoje) }

  if (filtros.obraId) where.obraId = filtros.obraId
  if (filtros.fornecedorId) where.fornecedorId = filtros.fornecedorId
  if (filtros.estado) where.estado = filtros.estado
  if (filtros.aConfirmar) where.obraAConfirmar = true

  if (filtros.busca?.trim()) {
    const b = filtros.busca.trim()
    where.OR = [
      { descricao: { contains: b } },
      { trCodigo: { contains: b } },
      { observacoes: { contains: b } },
      { numeroOrigem: { contains: b } },
    ]
  }

  return prisma.locacao.findMany({
    where,
    // `nulls: 'last'`: os itens sem prazo iam para o topo, acima dos vencidos, porque no
    // SQL NULL ordena antes de qualquer data. Quem abre a lista precisa ver primeiro o que
    // está atrasado, não os 6 registros que nem prazo têm.
    orderBy: [{ dataFim: { sort: 'asc', nulls: 'last' } }, { descricao: 'asc' }],
    include: {
      obra: { select: { id: true, codigo: true, cliente: true } },
      fornecedor: { select: { id: true, nome: true } },
    },
  })
}

export type LocacaoListada = Awaited<ReturnType<typeof listarLocacoes>>[number]

export async function obterLocacao(id: string) {
  return prisma.locacao.findUnique({
    where: { id },
    include: {
      obra: { select: { id: true, codigo: true, cliente: true, descricao: true } },
      fornecedor: { select: { id: true, nome: true, telefone: true } },
      movimentacoes: { orderBy: { criadoEm: 'desc' } },
    },
  })
}

export async function opcoesDeFiltro() {
  const [obras, fornecedores] = await Promise.all([
    prisma.obra.findMany({ where: { ativa: true }, orderBy: [{ cliente: 'asc' }, { codigo: 'asc' }],
      select: { id: true, codigo: true, cliente: true } }),
    prisma.fornecedor.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' },
      select: { id: true, nome: true } }),
  ])
  return { obras, fornecedores }
}
