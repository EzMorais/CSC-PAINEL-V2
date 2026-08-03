import { prisma } from '@/lib/prisma'
import { STATUS } from '@/lib/dominio/constantes'

export type FiltrosFuncionario = {
  busca?: string
  status?: string
  obraId?: string
  cargoId?: string
}

/**
 * Busca é sensível a acento e caixa — limitação do LIKE do SQLite, a mesma que o Painel
 * de Locação documenta. Na prática incomoda pouco porque a busca principal é por matrícula
 * e CPF (só dígitos); migrar para Postgres resolve.
 */
export async function listarFuncionarios(filtros: FiltrosFuncionario = {}) {
  const { busca, status, obraId, cargoId } = filtros
  const termo = busca?.trim()

  return prisma.funcionario.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(obraId ? { obraId } : {}),
      ...(cargoId ? { cargoId } : {}),
      ...(termo
        ? {
            OR: [
              { nome: { contains: termo } },
              { matricula: { contains: termo } },
              // O CPF é gravado só com dígitos; tirar a máscara do termo deixa
              // "529.982" encontrar quem foi salvo como "52998224725".
              { cpf: { contains: termo.replace(/\D/g, '') || termo } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { nome: 'asc' }],
    include: {
      obra: { select: { codigo: true, descricao: true } },
      cargo: { select: { nome: true } },
    },
  })
}

export type FuncionarioListado = Awaited<ReturnType<typeof listarFuncionarios>>[number]

export async function obterFuncionario(id: string) {
  return prisma.funcionario.findUnique({
    where: { id },
    include: {
      obra: { select: { id: true, codigo: true, descricao: true } },
      cargo: { select: { id: true, nome: true, risco: true } },
      dependentes: { orderBy: { nome: 'asc' } },
      eventos: {
        // Desempate por registro: dois eventos no mesmo dia (mudança de obra e de cargo
        // numa promoção, por exemplo) sairiam em ordem arbitrária só com `ocorridoEm`.
        orderBy: [{ ocorridoEm: 'desc' }, { registradoEm: 'desc' }],
      },
    },
  })
}

export type FuncionarioDetalhe = NonNullable<Awaited<ReturnType<typeof obterFuncionario>>>

/** Listas para os selects do formulário. */
export async function opcoes() {
  const [obras, cargos, departamentos] = await Promise.all([
    prisma.obra.findMany({ where: { ativa: true }, orderBy: { codigo: 'asc' }, select: { id: true, codigo: true, descricao: true } }),
    prisma.cargo.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    // Ramos e setores juntos, numa consulta só: a tela agrupa por `paiId` e precisa dos dois
    // para montar os <optgroup>.
    prisma.departamento.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, paiId: true } }),
  ])
  return { obras, cargos, departamentos }
}

/**
 * Próxima matrícula livre, no formato SC-0001.
 *
 * Lê o maior número existente em vez de contar registros: contar daria colisão assim que
 * alguém fosse excluído do cadastro.
 */
export async function proximaMatricula(): Promise<string> {
  const ultimo = await prisma.funcionario.findFirst({
    orderBy: { matricula: 'desc' },
    select: { matricula: true },
  })
  const numero = ultimo ? Number(ultimo.matricula.replace(/\D/g, '')) + 1 : 1
  return `SC-${String(numero).padStart(4, '0')}`
}

export async function contarPorStatus() {
  const [ativos, afastados, ferias, desligados] = await Promise.all([
    prisma.funcionario.count({ where: { status: STATUS.ATIVO } }),
    prisma.funcionario.count({ where: { status: STATUS.AFASTADO } }),
    prisma.funcionario.count({ where: { status: STATUS.FERIAS } }),
    prisma.funcionario.count({ where: { status: STATUS.DESLIGADO } }),
  ])
  return { ativos, afastados, ferias, desligados }
}
