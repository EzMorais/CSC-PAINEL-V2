'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { obterFuncionario } from '@/queries/funcionarios'
import { apenasDigitos, cpfValido } from '@/lib/dominio/cpf'
import { EVENTO, ROTULO_STATUS, STATUS, type Status } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

/** "" vira undefined: campo opcional em branco não deve gravar string vazia. */
const opcional = z.string().trim().optional().transform((v) => (v ? v : undefined))

/** Data de calendário em meia-noite UTC — o mesmo referencial do resto do sistema. */
const dataCalendario = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .transform((v) => {
    const [a, m, d] = v.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, d))
  })

const esquema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.'),
  cpf: z
    .string()
    .trim()
    .min(1, 'Informe o CPF.')
    .refine((v) => cpfValido(v), 'CPF inválido — confira os dígitos.')
    .transform(apenasDigitos),
  admitidoEm: dataCalendario,
  status: z.enum([STATUS.ATIVO, STATUS.AFASTADO, STATUS.FERIAS, STATUS.DESLIGADO]).default(STATUS.ATIVO),
  tipoContrato: z.string().trim().default('CLT'),

  rg: opcional,
  dataNascimento: z.union([dataCalendario, z.literal('')]).optional(),
  sexo: opcional,
  estadoCivil: opcional,
  nomeMae: opcional,

  telefone: opcional,
  email: z.union([z.string().trim().email('E-mail inválido.'), z.literal('')]).optional(),

  cep: opcional,
  logradouro: opcional,
  numero: opcional,
  complemento: opcional,
  bairro: opcional,
  cidade: opcional,
  uf: opcional,

  obraId: opcional,
  cargoId: opcional,
  salario: z.union([z.coerce.number().nonnegative('Salário não pode ser negativo.'), z.literal('')]).optional(),

  banco: opcional,
  agencia: opcional,
  conta: opcional,
  tipoConta: opcional,
  chavePix: opcional,

  tamanhoCamisa: opcional,
  tamanhoCalca: opcional,
  tamanhoCalcado: opcional,

  observacoes: opcional,
})

/** Normaliza o que o Zod devolve para o formato que o Prisma aceita. */
function paraBanco(d: z.infer<typeof esquema>) {
  return {
    nome: d.nome,
    cpf: d.cpf,
    admitidoEm: d.admitidoEm,
    status: d.status,
    tipoContrato: d.tipoContrato,
    rg: d.rg ?? null,
    dataNascimento: d.dataNascimento instanceof Date ? d.dataNascimento : null,
    sexo: d.sexo ?? null,
    estadoCivil: d.estadoCivil ?? null,
    nomeMae: d.nomeMae ?? null,
    telefone: d.telefone ?? null,
    email: d.email || null,
    cep: d.cep ?? null,
    logradouro: d.logradouro ?? null,
    numero: d.numero ?? null,
    complemento: d.complemento ?? null,
    bairro: d.bairro ?? null,
    cidade: d.cidade ?? null,
    uf: d.uf ?? null,
    obraId: d.obraId ?? null,
    cargoId: d.cargoId ?? null,
    salario: typeof d.salario === 'number' ? d.salario : null,
    banco: d.banco ?? null,
    agencia: d.agencia ?? null,
    conta: d.conta ?? null,
    tipoConta: d.tipoConta ?? null,
    chavePix: d.chavePix ?? null,
    tamanhoCamisa: d.tamanhoCamisa ?? null,
    tamanhoCalca: d.tamanhoCalca ?? null,
    tamanhoCalcado: d.tamanhoCalcado ?? null,
    observacoes: d.observacoes ?? null,
  }
}

function mensagem(e: unknown, padrao: string): string {
  if (e instanceof Error) {
    // O Prisma sinaliza violação de unicidade sem dizer o campo em texto amigável.
    if (e.message.includes('Unique') && e.message.includes('cpf')) {
      return 'Já existe um funcionário com este CPF.'
    }
    if (e.message.includes('Unique') && e.message.includes('matricula')) {
      return 'Matrícula já usada. Recarregue a página e tente de novo.'
    }
    return e.message
  }
  return padrao
}

export async function criarFuncionario(entrada: unknown, matricula: string): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const dados = paraBanco(parsed.data)

  try {
    const obra = dados.obraId
      ? await prisma.obra.findUnique({ where: { id: dados.obraId }, select: { codigo: true } })
      : null

    const funcionario = await prisma.funcionario.create({
      data: {
        ...dados,
        matricula,
        // A admissão nasce junto com o cadastro: a timeline não pode começar vazia para
        // alguém que, por definição, foi admitido.
        eventos: {
          create: {
            tipo: EVENTO.ADMISSAO,
            descricaoHumana: obra
              ? `Admitido em ${dataBR(dados.admitidoEm)} na obra ${obra.codigo}`
              : `Admitido em ${dataBR(dados.admitidoEm)}`,
            ocorridoEm: dados.admitidoEm,
            registradoPor: sessao.nome,
            obraId: dados.obraId,
          },
        },
      },
    })

    revalidarTelas('/', '/funcionarios')
    return { ok: true, dados: { id: funcionario.id } }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao cadastrar o funcionário.') }
  }
}

/**
 * Salva a edição e registra na timeline o que de fato mudou.
 *
 * Compara antes/depois em vez de confiar no que o formulário enviou: um salvamento que
 * não alterou a obra não pode gerar um evento de mudança de obra, senão a timeline vira
 * um log de cliques em vez de um histórico do funcionário.
 */
export async function editarFuncionario(id: string, entrada: unknown): Promise<Resultado> {
  const sessao = await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const dados = paraBanco(parsed.data)

  try {
    const antes = await prisma.funcionario.findUnique({
      where: { id },
      include: { obra: { select: { codigo: true } }, cargo: { select: { nome: true } } },
    })
    if (!antes) return { ok: false, erro: 'Funcionário não encontrado.' }

    const eventos: Array<{ tipo: string; descricaoHumana: string; obraId?: string | null }> = []

    if (dados.obraId !== antes.obraId) {
      const destino = dados.obraId
        ? await prisma.obra.findUnique({ where: { id: dados.obraId }, select: { codigo: true } })
        : null
      eventos.push({
        tipo: EVENTO.MUDANCA_OBRA,
        descricaoHumana: `Obra: ${antes.obra?.codigo ?? 'sem obra'} → ${destino?.codigo ?? 'sem obra'}`,
        obraId: dados.obraId,
      })
    }

    if (dados.cargoId !== antes.cargoId) {
      const destino = dados.cargoId
        ? await prisma.cargo.findUnique({ where: { id: dados.cargoId }, select: { nome: true } })
        : null
      eventos.push({
        tipo: EVENTO.MUDANCA_CARGO,
        descricaoHumana: `Cargo: ${antes.cargo?.nome ?? 'sem cargo'} → ${destino?.nome ?? 'sem cargo'}`,
      })
    }

    if (dados.status !== antes.status) {
      const TIPO_POR_STATUS: Record<Status, string> = {
        ATIVO: EVENTO.RETORNO,
        AFASTADO: EVENTO.AFASTAMENTO,
        FERIAS: EVENTO.FERIAS,
        DESLIGADO: EVENTO.DESLIGAMENTO,
      }
      eventos.push({
        tipo: TIPO_POR_STATUS[dados.status as Status],
        descricaoHumana: `Situação: ${ROTULO_STATUS[antes.status as Status] ?? antes.status} → ${ROTULO_STATUS[dados.status as Status]}`,
      })
    }

    // Uma transação só: gravar o cadastro e falhar ao gravar os eventos deixaria a
    // timeline mentindo sobre uma mudança que aconteceu.
    await prisma.$transaction([
      prisma.funcionario.update({ where: { id }, data: dados }),
      ...eventos.map((e) =>
        prisma.evento.create({
          data: {
            funcionarioId: id,
            tipo: e.tipo,
            descricaoHumana: e.descricaoHumana,
            ocorridoEm: new Date(),
            registradoPor: sessao.nome,
            obraId: e.obraId ?? null,
          },
        }),
      ),
    ])

    revalidarTelas('/', '/funcionarios', `/funcionarios/${id}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao salvar o funcionário.') }
  }
}

const esquemaEvento = z.object({
  tipo: z.string().trim().min(1, 'Escolha o tipo.'),
  descricaoHumana: z.string().trim().min(3, 'Descreva o que aconteceu.'),
  ocorridoEm: dataCalendario,
  detalhe: opcional,
})

/** Registro manual na timeline — advertência, promoção, observação. */
export async function registrarEvento(funcionarioId: string, entrada: unknown): Promise<Resultado> {
  const sessao = await exigirSessao()

  const parsed = esquemaEvento.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    const existe = await prisma.funcionario.findUnique({ where: { id: funcionarioId }, select: { obraId: true } })
    if (!existe) return { ok: false, erro: 'Funcionário não encontrado.' }

    await prisma.evento.create({
      data: {
        funcionarioId,
        tipo: parsed.data.tipo,
        descricaoHumana: parsed.data.descricaoHumana,
        detalhe: parsed.data.detalhe ?? null,
        ocorridoEm: parsed.data.ocorridoEm,
        registradoPor: sessao.nome,
        obraId: existe.obraId,
      },
    })

    revalidarTelas('/', `/funcionarios/${funcionarioId}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao registrar o evento.') }
  }
}

const esquemaDependente = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do dependente.'),
  parentesco: z.string().trim().min(1, 'Informe o parentesco.'),
  dataNascimento: z.union([dataCalendario, z.literal('')]).optional(),
  cpf: opcional,
  irrf: z.coerce.boolean().default(false),
  salarioFamilia: z.coerce.boolean().default(false),
})

export async function salvarDependente(funcionarioId: string, entrada: unknown): Promise<Resultado> {
  await exigirSessao()

  const parsed = esquemaDependente.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  // CPF de dependente é opcional, mas se vier tem de ser válido.
  if (d.cpf && !cpfValido(d.cpf)) {
    return { ok: false, erro: 'CPF do dependente é inválido.' }
  }

  try {
    await prisma.dependente.create({
      data: {
        funcionarioId,
        nome: d.nome,
        parentesco: d.parentesco,
        dataNascimento: d.dataNascimento instanceof Date ? d.dataNascimento : null,
        cpf: d.cpf ? apenasDigitos(d.cpf) : null,
        irrf: d.irrf,
        salarioFamilia: d.salarioFamilia,
      },
    })
    revalidarTelas(`/funcionarios/${funcionarioId}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao salvar o dependente.') }
  }
}

export async function removerDependente(id: string, funcionarioId: string): Promise<Resultado> {
  await exigirSessao()
  try {
    await prisma.dependente.delete({ where: { id } })
    revalidarTelas(`/funcionarios/${funcionarioId}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao remover o dependente.') }
  }
}

export async function carregarFuncionario(id: string) {
  await exigirSessao()
  return obterFuncionario(id)
}
