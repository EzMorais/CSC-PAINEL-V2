'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirLancamento } from '@/lib/auth'
import { revalidarTelas } from '@/lib/revalidar'
import { saldoDoMaterial } from '@/queries/saldos'
import { limitesDeAprovacao } from '@/queries/aprovacoes'
import { abrirPedido, precisaAprovacao } from '@/lib/pedir-aprovacao'
import { TIPO_APROVACAO } from '@/lib/dominio/aprovacoes'
import { enviarFichaEpi } from '@/lib/cliente-rh'
import {
  MOVIMENTACAO, SINAL_MOVIMENTACAO, EXIGE_OBRA, ROTULO_MOVIMENTACAO, exigeFuncionario,
  type TipoMovimentacao,
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
  funcionarioId: opcional,
  funcionarioNome: opcional,
  documento: opcional,
  observacao: opcional,
  ocorridoEm: dataCalendario,
})

/**
 * `id` vem nulo quando o lançamento virou pedido de aprovação: nada foi gravado no
 * livro-razão ainda, então não existe movimentação para apontar. `pendenteAprovacao` é o que
 * a tela lê para dizer à pessoa que deu certo, mas está esperando a gerência.
 */
export async function registrarMovimentacao(
  entrada: unknown,
): Promise<Resultado<{ id: string | null; pendenteAprovacao: boolean }>> {
  const sessao = await exigirLancamento()

  const parsed = esquema.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data
  const tipo = d.tipo as TipoMovimentacao

  try {
    const material = await prisma.material.findUnique({
      where: { id: d.materialId },
      select: { id: true, codigo: true, nome: true, unidade: true, ativo: true, categoria: true, ca: true, validadeCA: true },
    })
    if (!material) return { ok: false, erro: 'Material não encontrado.' }
    if (!material.ativo) return { ok: false, erro: 'Este material está inativo — reative o cadastro antes de movimentar.' }

    // Quem é o destino depende da CATEGORIA, não só do tipo: EPI sai para uma pessoa, o
    // resto sai para uma obra. Por isso as duas checagens vêm só agora, depois de carregar
    // o material — checar a obra antes disso recusaria toda entrega de EPI, já que o
    // formulário nem mostra o campo de obra nesse caso.
    const precisaFuncionario = exigeFuncionario(tipo, material.categoria)

    if (precisaFuncionario && !d.funcionarioId) {
      return { ok: false, erro: 'Saída de EPI precisa do funcionário que recebeu — é a ficha exigida pela NR-6.' }
    }
    if (!precisaFuncionario && EXIGE_OBRA.includes(tipo) && !d.obraId) {
      return { ok: false, erro: `${ROTULO_MOVIMENTACAO[tipo]} precisa da obra de destino.` }
    }

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

    // Perda tira material do saldo sem nada entrando em troca. Acima de nenhum limite: TODA
    // perda lançada por quem não aprova passa pela gerência, porque o valor da baixa não é
    // o que importa — é o fato de haver uma baixa sem contrapartida.
    if (tipo === MOVIMENTACAO.PERDA && precisaAprovacao(sessao.cargo, true)) {
      await abrirPedido({
        tipo: TIPO_APROVACAO.PERDA,
        resumo: `${material.nome}: baixa de ${d.quantidade} ${material.unidade} por perda ou quebra.`,
        dados: {
          materialId: d.materialId,
          quantidade: d.quantidade,
          ocorridoEm: d.ocorridoEm.toISOString(),
          documento: d.documento ?? null,
          observacao: d.observacao ?? null,
        },
        motivo: d.observacao ?? null,
        solicitanteId: sessao.id,
        solicitanteNome: sessao.nome,
      })
      revalidarTelas('/', '/aprovacoes', '/movimentacoes')
      return { ok: true, dados: { id: null, pendenteAprovacao: true } }
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
        funcionarioId: precisaFuncionario ? (d.funcionarioId ?? null) : null,
        funcionarioNome: precisaFuncionario ? (d.funcionarioNome ?? null) : null,
        documento: d.documento ?? null,
        observacao: d.observacao ?? null,
        ocorridoEm: d.ocorridoEm,
        registradoPor: sessao.nome,
      },
    })

    // A saída já está gravada. Se o envio da ficha falhar, o material saiu do mesmo jeito —
    // o que não pode é a falha passar despercebida, e por isso ela fica marcada na própria
    // movimentação e aparece na tela como pendente, para reenvio.
    if (precisaFuncionario) {
      await sincronizarFicha(movimentacao.id)
    }

    revalidarTelas('/', '/materiais', `/materiais/${d.materialId}`, '/movimentacoes', '/relatorios')
    return { ok: true, dados: { id: movimentacao.id, pendenteAprovacao: false } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao registrar a movimentação.' }
  }
}

/**
 * Envia (ou reenvia) ao RH a ficha de uma saída de EPI.
 *
 * Nunca lança: é chamada logo depois de uma gravação que já deu certo, e deixar uma exceção
 * subir daqui faria a movimentação parecer que falhou — o almoxarife lançaria de novo e o
 * material sairia duas vezes do saldo por causa de um sistema vizinho fora do ar.
 */
export async function sincronizarFicha(movimentacaoId: string): Promise<Resultado<{ pendente: boolean }>> {
  // Chamada tanto por dentro (logo após a saída) quanto pelo botão de reenviar na tela.
  // Sem esta guarda, o botão vira um endpoint aberto a quem só tem cargo de consulta.
  await exigirLancamento()

  try {
    const mov = await prisma.movimentacao.findUnique({
      where: { id: movimentacaoId },
      include: { material: { select: { codigo: true, nome: true, unidade: true, ca: true, validadeCA: true } } },
    })
    if (!mov) return { ok: false, erro: 'Movimentação não encontrada.' }
    if (!mov.funcionarioId) return { ok: false, erro: 'Esta movimentação não é uma entrega de EPI.' }
    if (mov.sincronizadoEm) return { ok: true, dados: { pendente: false } }

    const envio = await enviarFichaEpi({
      movimentacaoId: mov.id,
      funcionarioId: mov.funcionarioId,
      materialCodigo: mov.material.codigo,
      materialNome: mov.material.nome,
      unidade: mov.material.unidade,
      quantidade: mov.quantidade,
      ca: mov.material.ca,
      validadeCA: mov.material.validadeCA?.toISOString() ?? null,
      entregueEm: mov.ocorridoEm.toISOString(),
      entreguePor: mov.registradoPor,
      observacao: mov.observacao,
    })

    await prisma.movimentacao.update({
      where: { id: mov.id },
      data: envio.ok
        ? { sincronizadoEm: new Date(), erroSincronizacao: null }
        : { erroSincronizacao: envio.erro },
    })

    revalidarTelas('/movimentacoes', `/materiais/${mov.materialId}`)
    return envio.ok ? { ok: true, dados: { pendente: false } } : { ok: false, erro: envio.erro }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao sincronizar a ficha.' }
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
export async function ajustarPorInventario(
  entrada: unknown,
): Promise<Resultado<{ diferenca: number; pendenteAprovacao: boolean }>> {
  const sessao = await exigirLancamento()

  const parsed = esquemaInventario.safeParse(entrada)
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const d = parsed.data

  try {
    const material = await prisma.material.findUnique({
      where: { id: d.materialId },
      select: { id: true, nome: true, unidade: true },
    })
    if (!material) return { ok: false, erro: 'Material não encontrado.' }

    const saldo = await saldoDoMaterial(d.materialId)
    const diferenca = d.quantidadeContada - saldo

    if (diferenca === 0) {
      return { ok: false, erro: 'A contagem bate com o saldo do sistema — nada a ajustar.' }
    }

    // Ajuste grande some com estoque sem contrapartida: é a forma mais silenciosa de um
    // furo virar número certo. Acima do limite, o cargo Operacional pede e a gerência
    // decide — e nada muda no saldo até lá.
    const { ajuste: limite } = await limitesDeAprovacao()
    if (precisaAprovacao(sessao.cargo, Math.abs(diferenca) > limite)) {
      await abrirPedido({
        tipo: TIPO_APROVACAO.AJUSTE_INVENTARIO,
        resumo:
          `${material.nome}: contagem de ${d.quantidadeContada} ${material.unidade} contra ` +
          `${saldo} no sistema (${diferenca > 0 ? 'sobra' : 'falta'} de ${Math.abs(diferenca)}).`,
        dados: {
          materialId: d.materialId,
          quantidadeContada: d.quantidadeContada,
          observacao: d.observacao ?? null,
        },
        motivo: d.observacao ?? null,
        solicitanteId: sessao.id,
        solicitanteNome: sessao.nome,
      })
      revalidarTelas('/', '/aprovacoes', `/materiais/${d.materialId}`)
      return { ok: true, dados: { diferenca, pendenteAprovacao: true } }
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
    return { ok: true, dados: { diferenca, pendenteAprovacao: false } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao ajustar o inventário.' }
  }
}
