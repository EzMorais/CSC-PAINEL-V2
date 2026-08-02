'use server'

import { revalidarTelas } from '@/lib/revalidar'
import { z } from 'zod'
import { differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { MOVIMENTACAO } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'
import { obterLocacao } from '@/queries/locacoes'
import { exigirLancamento } from '@/lib/auth'

export type Resultado<T = void> = { ok: true; dados: T } | { ok: false; erro: string }

export async function carregarLocacao(id: string) {
  await exigirLancamento()
  return obterLocacao(id)
}

const esquemaLocacao = z.object({
  obraId: z.string().min(1, 'Selecione a obra.'),
  descricao: z.string().trim().min(2, 'Informe o equipamento.'),
  trCodigo: z.string().trim().optional(),
  fornecedorId: z.string().optional(),
  quantidade: z.coerce.number().int().min(1).default(1),
  dataInicio: z.coerce.date({ message: 'Data de início inválida.' }),
  dataFim: z.coerce.date({ message: 'Data de fim inválida.' }),
  valorItem: z.coerce.number().nonnegative().optional(),
  observacoes: z.string().trim().optional(),
})

export async function criarLocacao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  await exigirLancamento()
  const parsed = esquemaLocacao.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data
  if (d.dataFim < d.dataInicio) return { ok: false, erro: 'A data de fim é anterior à de início.' }

  try {
    const locacao = await prisma.locacao.create({
      data: {
        obraId: d.obraId,
        descricao: d.descricao.toUpperCase(),
        trCodigo: d.trCodigo || null,
        fornecedorId: d.fornecedorId || null,
        quantidade: d.quantidade,
        dataInicio: d.dataInicio,
        dataFim: d.dataFim,
        valorItem: d.valorItem ?? null,
        observacoes: d.observacoes || null,
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.REGISTRO,
            descricaoHumana: `Registrada de ${dataBR(d.dataInicio)} a ${dataBR(d.dataFim)}`,
          },
        },
      },
    })
    revalidarTelas('/', '/locacoes')
    return { ok: true, dados: { id: locacao.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar' }
  }
}

export async function editarLocacao(id: string, entrada: unknown): Promise<Resultado> {
  await exigirLancamento()
  const parsed = esquemaLocacao.partial().safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  try {
    const antes = await prisma.locacao.findUnique({ where: { id } })
    if (!antes) return { ok: false, erro: 'Locação não encontrada.' }

    const d = parsed.data

    // Valida a data contra o que FICARÁ gravado, não só contra o que veio no formulário.
    // Como a edição é parcial, alterar só o início pode invertê-lo em relação ao fim já
    // existente — e criar e transferir barram isso, mas editar não barrava. Uma locação
    // com fim antes do início produz duração negativa: o drawer mostra "Duração -5 dias"
    // e o Excel sai com período negativo mas valor cheio, ou seja, custo errado sem aviso.
    const inicioFinal = d.dataInicio ?? antes.dataInicio
    const fimFinal = d.dataFim ?? antes.dataFim
    if (inicioFinal && fimFinal && fimFinal < inicioFinal) {
      return { ok: false, erro: 'A data de fim ficaria anterior à de início.' }
    }

    await prisma.locacao.update({
      where: { id },
      data: {
        ...(d.obraId && { obraId: d.obraId }),
        ...(d.descricao && { descricao: d.descricao.toUpperCase() }),
        ...(d.trCodigo !== undefined && { trCodigo: d.trCodigo || null }),
        ...(d.fornecedorId !== undefined && { fornecedorId: d.fornecedorId || null }),
        ...(d.quantidade !== undefined && { quantidade: d.quantidade }),
        ...(d.dataInicio && { dataInicio: d.dataInicio }),
        ...(d.dataFim && { dataFim: d.dataFim }),
        ...(d.valorItem !== undefined && { valorItem: d.valorItem }),
        ...(d.observacoes !== undefined && { observacoes: d.observacoes || null }),
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.EDICAO,
            descricaoHumana: 'Dados editados',
            payloadAntes: JSON.stringify(antes),
            payloadDepois: JSON.stringify(d),
          },
        },
      },
    })
    revalidarTelas('/', '/locacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao editar' }
  }
}

export async function renovarLocacao(id: string, diasExtras?: number): Promise<Resultado<{ novaData: Date }>> {
  await exigirLancamento()
  try {
    const l = await prisma.locacao.findUnique({ where: { id } })
    if (!l) return { ok: false, erro: 'Locação não encontrada.' }
    if (l.devolvidaEm) return { ok: false, erro: 'Locação já devolvida — não pode ser renovada.' }
    if (!l.dataInicio || !l.dataFim) return { ok: false, erro: 'Locação sem datas — edite antes de renovar.' }

    const dias = diasExtras ?? differenceInCalendarDays(l.dataFim, l.dataInicio)
    if (dias <= 0) return { ok: false, erro: 'Período de renovação inválido.' }

    const novaData = new Date(l.dataFim)
    novaData.setUTCDate(novaData.getUTCDate() + dias)

    await prisma.locacao.update({
      where: { id },
      data: {
        dataFim: novaData,
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.RENOVACAO,
            descricaoHumana: `Renovada por ${dias} dias — novo fim ${dataBR(novaData)}`,
            payloadAntes: JSON.stringify({ dataFim: l.dataFim }),
            payloadDepois: JSON.stringify({ dataFim: novaData }),
          },
        },
      },
    })
    revalidarTelas('/', '/locacoes')
    return { ok: true, dados: { novaData } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao renovar' }
  }
}

/**
 * Preenche `devolvidaEm` e registra a movimentação. A linha NÃO é apagada nem recriada:
 * `dataInicio` fica intacta, então o tempo real que o equipamento passou na obra continua
 * legível. O app antigo apagava a linha e a recriava no bloco de devoluções com a data de
 * início sobrescrita — nas 63 devoluções importadas da planilha, início = fim, e o período
 * real já se perdeu. É esse apagamento que esta função existe para impedir.
 */
export async function devolverLocacao(id: string, dataDevolucao: Date, motivo?: string): Promise<Resultado> {
  await exigirLancamento()
  try {
    const l = await prisma.locacao.findUnique({ where: { id } })
    if (!l) return { ok: false, erro: 'Locação não encontrada.' }
    if (l.devolvidaEm) return { ok: false, erro: 'Locação já devolvida.' }

    await prisma.locacao.update({
      where: { id },
      data: {
        devolvidaEm: dataDevolucao,
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.DEVOLUCAO,
            descricaoHumana:
              `Devolvida em ${dataBR(dataDevolucao)}` +
              (l.dataInicio ? ` — permaneceu ${differenceInCalendarDays(dataDevolucao, l.dataInicio)} dias na obra` : '') +
              (motivo ? ` · ${motivo}` : ''),
          },
        },
      },
    })
    revalidarTelas('/', '/locacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao devolver' }
  }
}

export async function transferirLocacao(
  id: string, obraDestinoId: string, dataInicio: Date, dataFim: Date, motivo?: string
): Promise<Resultado> {
  await exigirLancamento()
  try {
    const l = await prisma.locacao.findUnique({ where: { id }, include: { obra: true } })
    if (!l) return { ok: false, erro: 'Locação não encontrada.' }
    if (l.devolvidaEm) return { ok: false, erro: 'Locação devolvida não pode ser transferida.' }
    if (l.obraId === obraDestinoId) return { ok: false, erro: 'A obra de destino é a mesma da origem.' }
    if (dataFim < dataInicio) return { ok: false, erro: 'A data de fim é anterior à de início.' }

    const destino = await prisma.obra.findUnique({ where: { id: obraDestinoId } })
    if (!destino) return { ok: false, erro: 'Obra de destino não encontrada.' }

    await prisma.locacao.update({
      where: { id },
      data: {
        obraId: obraDestinoId,
        dataInicio, dataFim,
        obraAConfirmar: false,
        movimentacoes: {
          create: {
            tipo: MOVIMENTACAO.TRANSFERENCIA,
            descricaoHumana:
              `Transferida de ${l.obra.codigo} para ${destino.codigo}` +
              ` — novo período ${dataBR(dataInicio)} a ${dataBR(dataFim)}` +
              (motivo ? ` · ${motivo}` : ''),
            payloadAntes: JSON.stringify({ obra: l.obra.codigo, dataInicio: l.dataInicio, dataFim: l.dataFim }),
            payloadDepois: JSON.stringify({ obra: destino.codigo, dataInicio, dataFim }),
          },
        },
      },
    })
    revalidarTelas('/', '/locacoes')
    return { ok: true, dados: undefined }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao transferir' }
  }
}

export async function reclassificarEmLote(ids: string[], obraDestinoId: string): Promise<Resultado<{ movidas: number }>> {
  await exigirLancamento()
  if (!ids.length) return { ok: false, erro: 'Nenhum item selecionado.' }
  try {
    const destino = await prisma.obra.findUnique({ where: { id: obraDestinoId } })
    if (!destino) return { ok: false, erro: 'Obra de destino não encontrada.' }

    await prisma.$transaction([
      prisma.locacao.updateMany({
        where: { id: { in: ids } },
        data: { obraId: obraDestinoId, obraAConfirmar: false },
      }),
      prisma.movimentacao.createMany({
        data: ids.map((locacaoId) => ({
          locacaoId,
          tipo: MOVIMENTACAO.RECLASSIFICACAO,
          descricaoHumana: `Obra confirmada como ${destino.codigo}`,
        })),
      }),
    ])
    revalidarTelas('/', '/locacoes')
    return { ok: true, dados: { movidas: ids.length } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao reclassificar' }
  }
}
