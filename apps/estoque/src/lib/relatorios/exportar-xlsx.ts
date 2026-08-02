import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { listarMateriaisComSaldo } from '@/queries/saldos'
import {
  ROTULO_CATEGORIA_MATERIAL, ROTULO_SITUACAO_SALDO, ROTULO_MOVIMENTACAO,
  SINAL_MOVIMENTACAO, type CategoriaMaterial, type SituacaoSaldo, type TipoMovimentacao,
} from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

function estilizarCabecalho(linha: ExcelJS.Row) {
  linha.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  linha.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  linha.height = 26
}

const COLUNAS_POSICAO = [
  { header: 'Código', width: 12 },
  { header: 'Material', width: 38 },
  { header: 'Categoria', width: 24 },
  { header: 'Unidade', width: 10 },
  { header: 'Saldo', width: 12 },
  { header: 'Estoque mínimo', width: 16 },
  { header: 'Situação', width: 18 },
  { header: 'Último preço', width: 14 },
  { header: 'Valor em estoque', width: 18 },
  { header: 'Localização', width: 20 },
]

const COLUNAS_MOVIMENTACOES = [
  { header: 'Data', width: 12 },
  { header: 'Tipo', width: 26 },
  { header: 'Código', width: 12 },
  { header: 'Material', width: 38 },
  { header: 'Quantidade', width: 14 },
  { header: 'Unidade', width: 10 },
  { header: 'Obra', width: 16 },
  { header: 'Fornecedor', width: 24 },
  { header: 'Preço unitário', width: 15 },
  { header: 'Documento', width: 18 },
  { header: 'Registrado por', width: 20 },
]

/**
 * `comDados: false` gera a mesma planilha, mesmas colunas, sem nenhuma linha — o modelo
 * que alguém preenche e devolve. Mesma função para os dois casos de propósito: modelo e
 * relatório real não podem divergir de coluna, senão o modelo mente sobre o formato
 * esperado.
 */
export async function gerarPlanilhaEstoque(comDados: boolean): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Almoxarifado — Siqueira Campos'
  wb.created = new Date()

  const posicao = wb.addWorksheet('POSIÇÃO DE ESTOQUE')
  posicao.columns = COLUNAS_POSICAO
  estilizarCabecalho(posicao.getRow(1))

  const movimentacoes = wb.addWorksheet('MOVIMENTAÇÕES')
  movimentacoes.columns = COLUNAS_MOVIMENTACOES
  estilizarCabecalho(movimentacoes.getRow(1))

  if (!comDados) return wb.xlsx.writeBuffer()

  const materiais = await listarMateriaisComSaldo()
  for (const m of materiais) {
    const linha = posicao.addRow([
      m.codigo,
      m.nome,
      ROTULO_CATEGORIA_MATERIAL[m.categoria as CategoriaMaterial] ?? m.categoria,
      m.unidade,
      m.saldo,
      m.estoqueMinimo || '',
      ROTULO_SITUACAO_SALDO[m.situacao as SituacaoSaldo] ?? m.situacao,
      m.ultimoPreco ?? '',
      m.valorEmEstoque ?? '',
      m.localizacao ?? '',
    ])
    linha.getCell(8).numFmt = 'R$ #,##0.00'
    linha.getCell(9).numFmt = 'R$ #,##0.00'
  }

  const lancamentos = await prisma.movimentacao.findMany({
    orderBy: [{ ocorridoEm: 'desc' }, { registradoEm: 'desc' }],
    include: {
      material: { select: { codigo: true, nome: true, unidade: true } },
      obra: { select: { codigo: true } },
      fornecedor: { select: { nome: true } },
    },
  })

  for (const l of lancamentos) {
    const sinal = SINAL_MOVIMENTACAO[l.tipo as TipoMovimentacao] ?? 0
    const linha = movimentacoes.addRow([
      dataBR(l.ocorridoEm),
      ROTULO_MOVIMENTACAO[l.tipo as TipoMovimentacao] ?? l.tipo,
      l.material.codigo,
      l.material.nome,
      // Assinada na planilha, ao contrário do banco: aqui a coluna é lida por gente e por
      // fórmula de Excel, e um SOMA() na coluna tem de dar o saldo — o que só acontece se
      // saída for negativa.
      sinal * l.quantidade,
      l.material.unidade,
      l.obra?.codigo ?? '',
      l.fornecedor?.nome ?? '',
      l.valorUnitario ?? '',
      l.documento ?? '',
      l.registradoPor ?? '',
    ])
    linha.getCell(9).numFmt = 'R$ #,##0.00'
  }

  return wb.xlsx.writeBuffer()
}
