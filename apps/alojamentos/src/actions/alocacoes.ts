'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { STATUS_ALOCACAO, TIPO_TRANSPORTE } from '@/lib/dominio/constantes'

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

const esquema = z.object({
  funcionarioId: z.string().trim().min(1, 'Escolha o funcionário.'),
  funcionarioNome: z.string().trim().min(1, 'Nome do funcionário não veio do RH.'),
  funcionarioMatricula: z.string().trim().min(1, 'Matrícula não veio do RH.'),
  obraCodigo: opcional,
  alojamentoId: z.string().trim().min(1, 'Escolha o alojamento.'),
  quartoId: opcional,
  dataEntrada: dataCalendario,
  transporteTipo: z
    .enum([TIPO_TRANSPORTE.PROPRIO, TIPO_TRANSPORTE.CARONA, TIPO_TRANSPORTE.ONIBUS])
    .default(TIPO_TRANSPORTE.PROPRIO),
  caronaComNome: opcional,
  rotaOnibusId: opcional,
  telefone: opcional,
  observacoes: opcional,
})

/**
 * Aloca alguém num alojamento.
 *
 * Nome e matrícula vêm da tela, que os pegou do RH — e ficam gravados aqui como cópia. Não
 * é redundância: é o que faz a lista de moradores continuar legível com o RH desligado, e
 * o que faz o histórico continuar contando a verdade se a pessoa for renomeada depois.
 */
export async function criarAlocacao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    // Uma cama por pessoa. Sem esta checagem, alocar de novo quem já mora em outro lugar
    // passaria calado e a mesma pessoa apareceria em dois alojamentos ao mesmo tempo.
    const jaMora = await prisma.alocacao.findFirst({
      where: { funcionarioId: d.funcionarioId, status: STATUS_ALOCACAO.ATIVA },
      include: { alojamento: { select: { nome: true } } },
    })
    if (jaMora) {
      return {
        ok: false,
        erro: `${jaMora.funcionarioNome} já está alocado em ${jaMora.alojamento.nome}. Encerre a alocação atual antes de mover.`,
      }
    }

    if (d.quartoId) {
      const quarto = await prisma.quarto.findUnique({
        where: { id: d.quartoId },
        include: { _count: { select: { alocacoes: { where: { status: STATUS_ALOCACAO.ATIVA } } } } },
      })
      if (!quarto) return { ok: false, erro: 'Quarto não encontrado.' }
      if (quarto._count.alocacoes >= quarto.capacidade) {
        return { ok: false, erro: `O quarto ${quarto.numero} já está lotado (${quarto.capacidade} lugares).` }
      }
    }

    // Liga na obra local, se o código bater. Sem obra cadastrada aqui, a alocação vale
    // do mesmo jeito — o código fica guardado no campo de texto para quando ela existir.
    const obra = d.obraCodigo
      ? await prisma.obra.findUnique({ where: { codigo: d.obraCodigo }, select: { id: true } })
      : null

    const criada = await prisma.alocacao.create({
      data: {
        funcionarioId: d.funcionarioId,
        funcionarioNome: d.funcionarioNome,
        funcionarioMatricula: d.funcionarioMatricula,
        obraCodigo: d.obraCodigo ?? null,
        obraId: obra?.id ?? null,
        alojamentoId: d.alojamentoId,
        quartoId: d.quartoId ?? null,
        dataEntrada: d.dataEntrada,
        transporteTipo: d.transporteTipo,
        caronaComNome: d.transporteTipo === TIPO_TRANSPORTE.CARONA ? d.caronaComNome ?? null : null,
        rotaOnibusId: d.transporteTipo === TIPO_TRANSPORTE.ONIBUS ? d.rotaOnibusId ?? null : null,
        telefone: d.telefone ?? null,
        observacoes: d.observacoes ?? null,
        registradoPor: (await exigirLancamento()).nome,
      },
    })

    revalidarTelas('/', '/moradores', '/alojamentos', `/alojamentos/${d.alojamentoId}`)
    return { ok: true, dados: { id: criada.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao alocar.' }
  }
}

const esquemaSaida = z.object({
  dataSaida: dataCalendario,
  motivoSaida: opcional,
})

/** Encerra a alocação. O registro continua no histórico — quem morou, morou. */
export async function encerrarAlocacao(id: string, entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquemaSaida.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }

  try {
    const atual = await prisma.alocacao.findUnique({ where: { id }, select: { dataEntrada: true, status: true, alojamentoId: true } })
    if (!atual) return { ok: false, erro: 'Alocação não encontrada.' }
    if (atual.status === STATUS_ALOCACAO.ENCERRADA) return { ok: false, erro: 'Esta alocação já foi encerrada.' }
    if (parsed.data.dataSaida < atual.dataEntrada) {
      return { ok: false, erro: 'A data de saída não pode ser anterior à de entrada.' }
    }

    await prisma.alocacao.update({
      where: { id },
      data: {
        status: STATUS_ALOCACAO.ENCERRADA,
        dataSaida: parsed.data.dataSaida,
        motivoSaida: parsed.data.motivoSaida ?? null,
      },
    })

    revalidarTelas('/', '/moradores', '/alojamentos', `/alojamentos/${atual.alojamentoId}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao encerrar.' }
  }
}

const esquemaTransporte = z.object({
  transporteTipo: z.enum([TIPO_TRANSPORTE.PROPRIO, TIPO_TRANSPORTE.CARONA, TIPO_TRANSPORTE.ONIBUS]),
  caronaComNome: opcional,
  rotaOnibusId: opcional,
})

/**
 * Grava o WhatsApp de quem já está alocado.
 *
 * Separado do formulário de alocação porque a maioria dos moradores foi cadastrada antes de
 * o WhatsApp existir no módulo — sem uma forma de preencher depois, o recurso só valeria
 * para quem entrasse a partir de agora.
 */
export async function atualizarTelefone(id: string, telefone: string): Promise<Resultado> {
  await exigirLancamento()

  const limpo = telefone.trim()
  // Só dígitos suficientes para um número brasileiro com DDD. Guardar meio número faria a
  // mensagem que chegasse não casar com ninguém, sem nenhum aviso de que o cadastro é que
  // estava incompleto.
  if (limpo && limpo.replace(/\D/g, '').length < 10) {
    return { ok: false, erro: 'Informe o número com DDD, ou deixe em branco.' }
  }

  try {
    await prisma.alocacao.update({ where: { id }, data: { telefone: limpo || null } })
    revalidarTelas('/moradores')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o telefone.' }
  }
}

export async function atualizarTransporte(id: string, entrada: unknown): Promise<Resultado> {
  await exigirLancamento()

  const parsed = esquemaTransporte.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    await prisma.alocacao.update({
      where: { id },
      data: {
        transporteTipo: d.transporteTipo,
        caronaComNome: d.transporteTipo === TIPO_TRANSPORTE.CARONA ? d.caronaComNome ?? null : null,
        rotaOnibusId: d.transporteTipo === TIPO_TRANSPORTE.ONIBUS ? d.rotaOnibusId ?? null : null,
      },
    })
    revalidarTelas('/moradores')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao salvar o transporte.' }
  }
}
