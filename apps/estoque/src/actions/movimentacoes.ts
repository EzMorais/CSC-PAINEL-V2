'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { saldoDoMaterial } from '@/queries/saldos'
import {
  MOVIMENTACAO, SINAL_MOVIMENTACAO, EXIGE_OBRA, ROTULO_MOVIMENTACAO, type TipoMovimentacao,
} from '@/lib/dominio/constantes'

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
  materialId: z.string().trim().min(1, 'Selecione o material.'),
  tipo: z.enum([
    MOVIMENTACAO.ENTRADA, MOVIMENTACAO.SAIDA, MOVIMENTACAO.DEVOLUCAO,
    MOVIMENTACAO.PERDA, MOVIMENTACAO.AJUSTE_POSITIVO, MOVIMENTACAO.AJUSTE_NEGATIVO,
  ]),
  quantidade: z.coerce.number().positive('A quantidade tem de ser maior que zero.'),
  valorUnitario: z.union([z.coerce.number().nonnegative('Valor não pode ser negativo.'), z.literal('')]).optional(),
  obraId: opcional,
  fornecedorId: opcional,
  documento: opcional,
  observacao: opcional,
  ocorridoEm: dataCalendario,
})

export async function registrarMovimentacao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const sessao = await exigirSessao()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data
  const tipo = d.tipo as TipoMovimentacao

  if (EXIGE_OBRA.includes(tipo) && !d.obraId) {
    return { ok: false, erro: `${ROTULO_MOVIMENTACAO[tipo]} precisa da obra de destino.` }
  }

  try {
    const material = await prisma.material.findUnique({
      where: { id: d.materialId },
      select: { id: true, nome: true, unidade: true, ativo: true },
    })
    if (!material) return { ok: false, erro: 'Material não encontrado.' }
    if (!material.ativo) return { ok: false, erro: 'Este material está inativo — reative o cadastro antes de movimentar.' }

    // Saída que deixaria o saldo negativo é recusada. Um saldo negativo não existe no
    // mundo físico: significa que a prateleira e o sistema discordam, e deixar passar
    // espalha esse desencontro por todo relatório daqui para frente. A mensagem aponta o
    // caminho certo — ajuste de inventário — em vez de só bloquear.
    if (SINAL_MOVIMENTACAO[tipo] === -1) {
      const saldo = await saldoDoMaterial(d.materialId)
      if (d.quantidade > saldo) {
        return {
          ok: false,
          erro:
            `Saldo insuficiente: há ${saldo} ${material.unidade} de "${material.nome}" em estoque. ` +
            'Se a quantidade física for outra, lance um ajuste de inventário antes.',
        }
      }
    }

    const movimentacao = await prisma.movimentacao.create({
      data: {
        materialId: d.materialId,
        tipo,
        quantidade: d.quantidade,
        valorUnitario: typeof d.valorUnitario === 'number' ? d.valorUnitario : null,
        // Obra e fornecedor só são gravados onde fazem sentido: uma perda não tem
        // fornecedor, e guardar um deixaria o extrato sugerindo que o fornecedor teve
        // alguma coisa a ver com a quebra.
        obraId: EXIGE_OBRA.includes(tipo) ? (d.obraId ?? null) : null,
        fornecedorId: tipo === MOVIMENTACAO.ENTRADA ? (d.fornecedorId ?? null) : null,
        documento: d.documento ?? null,
        observacao: d.observacao ?? null,
        ocorridoEm: d.ocorridoEm,
        registradoPor: sessao.nome,
      },
    })

    revalidarTelas('/', '/materiais', `/materiais/${d.materialId}`, '/movimentacoes', '/relatorios')
    return { ok: true, dados: { id: movimentacao.id } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar a movimentação.' }
  }
}

const esquemaInventario = z.object({
  materialId: z.string().trim().min(1, 'Selecione o material.'),
  quantidadeContada: z.coerce.number().nonnegative('A quantidade contada não pode ser negativa.'),
  observacao: opcional,
})

/**
 * Acerta o saldo pela contagem física.
 *
 * Quem conta a prateleira sabe quantas unidades tem, não a diferença para o sistema — pedir
 * a diferença obrigaria o almoxarife a fazer a conta de cabeça e a escolher o tipo certo,
 * duas chances de errar. Ele digita o que contou e o sistema deriva o ajuste.
 */
export async function ajustarPorInventario(entrada: unknown): Promise<Resultado<{ diferenca: number }>> {
  const sessao = await exigirSessao()

  const parsed = esquemaInventario.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const material = await prisma.material.findUnique({ where: { id: d.materialId }, select: { id: true } })
    if (!material) return { ok: false, erro: 'Material não encontrado.' }

    const saldo = await saldoDoMaterial(d.materialId)
    const diferenca = d.quantidadeContada - saldo

    if (diferenca === 0) {
      return { ok: false, erro: 'A contagem bate com o saldo do sistema — nada a ajustar.' }
    }

    await prisma.movimentacao.create({
      data: {
        materialId: d.materialId,
        tipo: diferenca > 0 ? MOVIMENTACAO.AJUSTE_POSITIVO : MOVIMENTACAO.AJUSTE_NEGATIVO,
        quantidade: Math.abs(diferenca),
        ocorridoEm: new Date(),
        registradoPor: sessao.nome,
        observacao:
          `Inventário: contado ${d.quantidadeContada}, sistema apontava ${saldo}.` +
          (d.observacao ? ` ${d.observacao}` : ''),
      },
    })

    revalidarTelas('/', '/materiais', `/materiais/${d.materialId}`, '/movimentacoes', '/relatorios')
    return { ok: true, dados: { diferenca } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao ajustar o inventário.' }
  }
}
