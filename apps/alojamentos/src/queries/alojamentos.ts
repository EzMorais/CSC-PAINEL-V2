import { prisma } from '@/lib/prisma'
import { STATUS_ALOCACAO } from '@/lib/dominio/constantes'

/**
 * A capacidade que vale é a soma dos quartos.
 *
 * `Alojamento.capacidadeTotal` é só o número que alguém digitou às pressas antes de
 * detalhar os quartos — usar ele quando existem quartos cadastrados faria a tela mostrar
 * uma lotação diferente da que o próprio sistema consegue provar.
 */
function capacidadeReal(a: { capacidadeTotal: number | null; quartos: Array<{ capacidade: number }> }): number {
  if (a.quartos.length > 0) return a.quartos.reduce((s, q) => s + q.capacidade, 0)
  return a.capacidadeTotal ?? 0
}

export async function listarAlojamentos() {
  const alojamentos = await prisma.alojamento.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: {
      quartos: { where: { ativo: true }, select: { capacidade: true } },
      _count: { select: { alocacoes: { where: { status: STATUS_ALOCACAO.ATIVA } } } },
    },
  })

  return alojamentos.map((a) => ({
    id: a.id,
    nome: a.nome,
    cidade: a.cidade,
    uf: a.uf,
    bairro: a.bairro,
    ativo: a.ativo,
    foto: a.foto,
    responsavelNome: a.responsavelNome,
    telefoneResponsavel: a.telefoneResponsavel,
    temCoordenada: a.lat != null && a.lng != null,
    quartos: a.quartos.length,
    capacidade: capacidadeReal(a),
    ocupados: a._count.alocacoes,
  }))
}

export type AlojamentoListado = Awaited<ReturnType<typeof listarAlojamentos>>[number]

export async function obterAlojamento(id: string) {
  return prisma.alojamento.findUnique({
    where: { id },
    include: {
      quartos: { orderBy: { numero: 'asc' }, include: {
        _count: { select: { alocacoes: { where: { status: STATUS_ALOCACAO.ATIVA } } } },
      } },
      alocacoes: {
        where: { status: STATUS_ALOCACAO.ATIVA },
        orderBy: { funcionarioNome: 'asc' },
        include: { quarto: { select: { numero: true } }, rotaOnibus: { select: { nome: true } } },
      },
      distancias: { include: { obra: { select: { codigo: true, descricao: true } } } },
    },
  })
}

export type AlojamentoDetalhe = NonNullable<Awaited<ReturnType<typeof obterAlojamento>>>

/** Alojamentos ativos, para os <select> de outras telas. */
export async function opcoesAlojamento() {
  const [alojamentos, obras, rotas] = await Promise.all([
    prisma.alojamento.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true, nome: true,
        quartos: { where: { ativo: true }, orderBy: { numero: 'asc' }, select: { id: true, numero: true, capacidade: true } },
      },
    }),
    prisma.obra.findMany({ where: { ativa: true }, orderBy: { codigo: 'asc' }, select: { id: true, codigo: true, descricao: true } }),
    prisma.rotaOnibus.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
  ])
  return { alojamentos, obras, rotas }
}
