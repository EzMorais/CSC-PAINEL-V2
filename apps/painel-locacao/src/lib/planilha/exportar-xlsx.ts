import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { calcularStatus, diasRestantes } from '@/lib/dominio/status'
import { duracaoEmDias, periodoPorDias, quantidadePeriodos, valorTotal } from '@/lib/dominio/periodo'
import { ROTULO_STATUS } from '@/lib/dominio/constantes'

const CABECALHOS = [
  'Nº', 'DESCRIÇÃO DO EQUIPAMENTO', 'Tr Código', 'INÍCIO LOCAÇÃO', 'FIM LOCAÇÃO',
  'DIAS TOTAIS', 'DIAS RESTANTES', 'STATUS', 'QUAL PERIODO?', 'PERIODOS',
  'VALOR DO ITEM', 'VALOR GASTO TOTAL', 'FORNECEDOR', 'QTD', 'ESTADO', 'OBSERVAÇÕES',
]

const LARGURAS = [6, 38, 12, 14, 14, 11, 13, 12, 14, 10, 14, 16, 24, 6, 12, 30]

function estilizarCabecalho(linha: ExcelJS.Row) {
  linha.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  linha.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  linha.height = 28
}

const COR_STATUS: Record<string, string> = {
  VENCIDA: 'FFFEE2E2',
  ATENCAO: 'FFFEF3C7',
  ATIVA: 'FFDCFCE7',
  DEVOLVIDA: 'FFF1F5F9',
  SEM_PRAZO: 'FFF1F5F9',
}

export async function gerarPlanilha(hoje = new Date()): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Painel de Locação SC'
  wb.created = hoje

  const obras = await prisma.obra.findMany({
    orderBy: [{ cliente: 'asc' }, { codigo: 'asc' }],
    include: {
      locacoes: {
        orderBy: [{ devolvidaEm: 'asc' }, { dataFim: 'asc' }],
        include: { fornecedor: { select: { nome: true } } },
      },
    },
  })

  // Aba de resumo
  const resumo = wb.addWorksheet('RESUMO')
  resumo.columns = [
    { header: 'CLIENTE', width: 22 }, { header: 'Nº OBRA', width: 16 },
    { header: 'DESCRIÇÃO DA OBRA', width: 40 }, { header: 'RESPONSÁVEL', width: 16 },
    { header: 'ITENS ATIVOS', width: 14 }, { header: 'VALOR EM LOCAÇÃO', width: 20 },
  ]
  estilizarCabecalho(resumo.getRow(1))

  let totalGeral = 0
  for (const obra of obras) {
    const ativas = obra.locacoes.filter((l) => !l.devolvidaEm)
    const valor = ativas.reduce((s, l) => s + valorTotal(l.valorItem, l.dataInicio, l.dataFim), 0)
    totalGeral += valor
    const linha = resumo.addRow([obra.cliente, obra.codigo, obra.descricao, obra.responsavel ?? '', ativas.length, valor])
    linha.getCell(6).numFmt = 'R$ #,##0.00'
  }
  const linhaTotal = resumo.addRow(['', '', 'TOTAL GERAL', '', '', totalGeral])
  linhaTotal.font = { bold: true }
  linhaTotal.getCell(6).numFmt = 'R$ #,##0.00'

  // Uma aba por obra
  for (const obra of obras) {
    // O Excel proíbe : \ / ? * [ ] em nome de aba e limita a 31 caracteres
    const nomeAba = obra.codigo.replace(/[:\\/?*[\]]/g, '-').slice(0, 31)
    const ws = wb.addWorksheet(nomeAba)

    ws.addRow([`${obra.cliente} — ${obra.codigo} — ${obra.descricao}`]).font = { bold: true, size: 12 }
    ws.addRow([`Emitido em ${hoje.toLocaleDateString('pt-BR')}`]).font = { size: 9, color: { argb: 'FF64748B' } }
    ws.addRow([])

    ws.addRow(['LOCAÇÕES']).font = { bold: true }
    const cab = ws.addRow(CABECALHOS)
    estilizarCabecalho(cab)
    LARGURAS.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    const escrever = (l: (typeof obra.locacoes)[number]) => {
      const dias = duracaoEmDias(l.dataInicio, l.dataFim)
      const status = calcularStatus({ dataFim: l.dataFim, devolvidaEm: l.devolvidaEm }, hoje)
      // Usa diasRestantes() do domínio, a mesma função que alimenta a etiqueta na tela.
      // Subtrair milissegundos aqui faria esta coluna discordar da coluna STATUS ao lado,
      // porque as datas são gravadas como meia-noite UTC representando dia de calendário.
      const restantes = !l.devolvidaEm ? (diasRestantes(l.dataFim, hoje) ?? '') : ''

      const linha = ws.addRow([
        l.numeroOrigem ?? '', l.descricao, l.trCodigo ?? '',
        l.dataInicio ?? '', l.dataFim ?? '',
        dias || '', restantes,
        ROTULO_STATUS[status],
        dias ? periodoPorDias(dias) : '',
        dias ? quantidadePeriodos(dias) : '',
        l.valorItem ?? '', valorTotal(l.valorItem, l.dataInicio, l.dataFim),
        l.fornecedor?.nome ?? '', l.quantidade, l.estado, l.observacoes ?? '',
      ])

      linha.getCell(4).numFmt = 'DD/MM/YYYY'
      linha.getCell(5).numFmt = 'DD/MM/YYYY'
      linha.getCell(11).numFmt = 'R$ #,##0.00'
      linha.getCell(12).numFmt = 'R$ #,##0.00'
      linha.getCell(8).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: COR_STATUS[status] ?? 'FFFFFFFF' },
      }
      return linha
    }

    for (const l of obra.locacoes.filter((x) => !x.devolvidaEm)) escrever(l)

    const devolvidas = obra.locacoes.filter((l) => l.devolvidaEm)
    if (devolvidas.length) {
      ws.addRow([])
      ws.addRow(['DEVOLUÇÕES']).font = { bold: true }
      estilizarCabecalho(ws.addRow(CABECALHOS))
      for (const l of devolvidas) escrever(l)
    }

    ws.views = [{ state: 'frozen', ySplit: 5 }]
  }

  return wb.xlsx.writeBuffer()
}
