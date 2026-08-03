'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento, exigirAdministracao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { obterFuncionario } from '@/queries/funcionarios'
import { apenasDigitos, cpfValido } from '@/lib/dominio/cpf'
import { EVENTO, NIVEL_OBRA, ROTULO_STATUS, STATUS, type Status } from '@/lib/dominio/constantes'
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
  /**
   * Foto já convertida para data URI pela tela (`lib/imagem-cliente.ts`).
   *
   * A checagem do prefixo não é firula: sem ela, um nome de arquivo escapando do formulário
   * viraria um `src` quebrado em toda listagem, e a causa só apareceria olhando o banco.
   */
  foto: z
    .union([z.string().trim().startsWith('data:image/', 'Foto inválida — envie uma imagem.'), z.literal('')])
    .optional(),

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
  departamentoId: opcional,
  nivelObra: z.union([z.enum(NIVEL_OBRA), z.literal('')]).optional(),
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
    foto: d.foto || null,
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
    departamentoId: d.departamentoId ?? null,
    nivelObra: d.nivelObra || null,
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
  const sessao = await exigirLancamento()

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
  const sessao = await exigirLancamento()

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
  const sessao = await exigirLancamento()

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
  await exigirLancamento()

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
  await exigirLancamento()
  try {
    await prisma.dependente.delete({ where: { id } })
    revalidarTelas(`/funcionarios/${funcionarioId}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao remover o dependente.') }
  }
}

export async function carregarFuncionario(id: string) {
  await exigirLancamento()
  return obterFuncionario(id)
}

export type Vinculos = {
  entregasEpi: number
  entregasUniforme: number
  exames: number
  treinamentos: number
  documentos: number
  eventos: number
  dependentes: number
  total: number
}

/** O que está pendurado no funcionário. A tela mostra antes de perguntar se apaga mesmo. */
export async function vinculosDoFuncionario(id: string): Promise<Resultado<Vinculos>> {
  await exigirLancamento()
  try {
    const [entregasEpi, entregasUniforme, exames, treinamentos, documentos, eventos, dependentes] =
      await Promise.all([
        prisma.entregaEpi.count({ where: { funcionarioId: id } }),
        prisma.entregaUniforme.count({ where: { funcionarioId: id } }),
        prisma.exame.count({ where: { funcionarioId: id } }),
        prisma.treinamentoParticipante.count({ where: { funcionarioId: id } }),
        prisma.documento.count({ where: { funcionarioId: id } }),
        prisma.evento.count({ where: { funcionarioId: id } }),
        prisma.dependente.count({ where: { funcionarioId: id } }),
      ])

    // Eventos e dependentes ficam fora do total: evento é gerado pelo próprio sistema a cada
    // admissão e mudança de status, e dependente só existe por causa desta pessoa. Nenhum
    // dos dois é prova exigida por lei — contá-los faria toda exclusão parecer perigosa e a
    // trava perderia o sentido.
    const total = entregasEpi + entregasUniforme + exames + treinamentos + documentos

    return {
      ok: true,
      dados: { entregasEpi, entregasUniforme, exames, treinamentos, documentos, eventos, dependentes, total },
    }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao conferir os vínculos.') }
  }
}

/**
 * Apaga o funcionário de vez.
 *
 * Só o administrador, e só quem NÃO tem registro de EPI, uniforme, exame, treinamento ou
 * documento. Não é zelo excessivo: ficha de entrega de EPI é a prova que a NR-6 exige, e
 * ASO é o que a fiscalização pede. Apagar a pessoa apagaria a prova junto, e a empresa
 * descobriria isso numa autuação, anos depois.
 *
 * Para quem tem histórico existe o desligamento (`status = DESLIGADO`), que é o que a
 * situação real quase sempre pede: a pessoa saiu, e o que ela recebeu continua provado.
 *
 * Esta função serve ao outro caso, o que hoje não tem saída nenhuma: o cadastro criado
 * errado — nome duplicado, CPF trocado, pessoa que nunca chegou a trabalhar.
 */
export async function excluirFuncionario(id: string): Promise<Resultado<{ nome: string }>> {
  await exigirAdministracao()

  try {
    const funcionario = await prisma.funcionario.findUnique({
      where: { id },
      select: { nome: true },
    })
    if (!funcionario) return { ok: false, erro: 'Funcionário não encontrado.' }

    const vinculos = await vinculosDoFuncionario(id)
    if (!vinculos.ok) return vinculos
    if (vinculos.dados.total > 0) {
      const partes = [
        vinculos.dados.entregasEpi && `${vinculos.dados.entregasEpi} entregas de EPI`,
        vinculos.dados.entregasUniforme && `${vinculos.dados.entregasUniforme} entregas de uniforme`,
        vinculos.dados.exames && `${vinculos.dados.exames} exames`,
        vinculos.dados.treinamentos && `${vinculos.dados.treinamentos} treinamentos`,
        vinculos.dados.documentos && `${vinculos.dados.documentos} documentos`,
      ].filter(Boolean)

      return {
        ok: false,
        erro:
          `${funcionario.nome} tem ${partes.join(', ')}. Esses registros são a prova de que a ` +
          'empresa entregou EPI e fez os exames — apagar a pessoa apagaria a prova junto. ' +
          'Registre o desligamento em vez de excluir.',
      }
    }

    // Numa transação: apagar a pessoa e deixar evento ou dependente órfão deixaria linhas
    // apontando para um id que não existe mais, e a linha do tempo quebraria na próxima tela.
    await prisma.$transaction([
      prisma.evento.deleteMany({ where: { funcionarioId: id } }),
      prisma.dependente.deleteMany({ where: { funcionarioId: id } }),
      prisma.funcionario.delete({ where: { id } }),
    ])

    revalidarTelas('/funcionarios', '/')
    return { ok: true, dados: { nome: funcionario.nome } }
  } catch (e) {
    return { ok: false, erro: mensagem(e, 'Falha ao excluir o funcionário.') }
  }
}
