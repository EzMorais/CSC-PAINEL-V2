import PDFDocument from 'pdfkit'
import { prisma } from '@/lib/prisma'
import { brl, dataBR, dataLocalBR } from '@/lib/dominio/formato'
import { valorTotal } from '@/lib/dominio/periodo'
import { calcularStatus, rotuloVencimento } from '@/lib/dominio/status'

const COLUNAS = [
  { titulo: 'Equipamento', largura: 180 },
  { titulo: 'Tr',          largura: 55 },
  { titulo: 'Fornecedor',  largura: 130 },
  { titulo: 'Início',      largura: 62 },
  { titulo: 'Fim',         largura: 62 },
  { titulo: 'Situação',    largura: 95 },
  { titulo: 'Total',       largura: 78, direita: true },
]

const COR_STATUS: Record<string, string> = {
  VENCIDA: '#dc2626',
  ATENCAO: '#d97706',
  ATIVA: '#16a34a',
  SEM_PRAZO: '#64748b',
  DEVOLVIDA: '#64748b',
}

export async function gerarPdf(hoje = new Date()): Promise<Buffer> {
  const obras = await prisma.obra.findMany({
    where: { ativa: true },
    orderBy: [{ cliente: 'asc' }, { codigo: 'asc' }],
    include: {
      locacoes: {
        where: { devolvidaEm: null },
        orderBy: { dataFim: 'asc' },
        include: { fornecedor: { select: { nome: true } } },
      },
    },
  })

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32 })
  const pedacos: Buffer[] = []
  doc.on('data', (c: Buffer) => pedacos.push(c))
  const pronto = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(pedacos))))

  const larguraUtil = doc.page.width - 64
  let primeira = true

  for (const obra of obras) {
    if (!obra.locacoes.length) continue
    if (!primeira) doc.addPage()
    primeira = false

    doc.fontSize(15).fillColor('#0f172a').text('Construtora Siqueira Campos', { continued: false })
    doc.fontSize(9).fillColor('#64748b')
       // dataLocalBR, não dataBR: "hoje" é um instante real, não uma data armazenada.
       // Com o formatador UTC o carimbo adianta um dia depois das 21h em Brasília.
       .text(`Painel de Locação · emitido em ${dataLocalBR(hoje)}`)
    doc.moveDown(0.6)

    doc.fontSize(12).fillColor('#0f172a').text(`${obra.cliente} — ${obra.codigo}`)
    doc.fontSize(9).fillColor('#64748b').text(obra.descricao)
    doc.moveDown(0.5)

    // Desenha a faixa de cabeçalho da tabela e devolve o y logo abaixo dela.
    // Precisa ser reaproveitável: obras grandes transbordam para 2-3 páginas, e uma
    // página de continuação sem cabeçalho vira uma lista de colunas anônimas na mão de
    // quem recebe o PDF impresso.
    const cabecalhoTabela = (topo: number): number => {
      doc.rect(32, topo, larguraUtil, 18).fill('#0f172a')
      let cx = 36
      doc.fontSize(8).fillColor('#ffffff')
      for (const col of COLUNAS) {
        doc.text(col.titulo, cx, topo + 5, {
          width: col.largura - 6,
          align: col.direita ? 'right' : 'left',
        })
        cx += col.largura
      }
      return topo + 18
    }

    let y = cabecalhoTabela(doc.y)
    let x = 36
    let pagina = 1

    let total = 0
    for (const l of obra.locacoes) {
      // Quebra de página quando falta espaço
      if (y > doc.page.height - 70) {
        doc.addPage()
        pagina += 1
        y = 40
        doc.fontSize(9).fillColor('#64748b')
           .text(`${obra.cliente} — ${obra.codigo} (continuação, página ${pagina})`, 32, y)
        y += 16
        y = cabecalhoTabela(y)
      }

      const status = calcularStatus({ dataFim: l.dataFim, devolvidaEm: l.devolvidaEm }, hoje)
      const valor = valorTotal(l.valorItem, l.dataInicio, l.dataFim)
      total += valor

      doc.rect(32, y, larguraUtil, 16).fill(y % 32 === 0 ? '#f8fafc' : '#ffffff')

      const celulas = [
        l.descricao.slice(0, 42),
        l.trCodigo ?? '—',
        (l.fornecedor?.nome ?? '—').slice(0, 26),
        dataBR(l.dataInicio),
        dataBR(l.dataFim),
        rotuloVencimento(l.dataFim, hoje),
        brl(valor),
      ]

      x = 36
      doc.fontSize(7.5)
      celulas.forEach((texto, i) => {
        doc.fillColor(i === 5 ? (COR_STATUS[status] ?? '#1f2328') : '#1f2328')
        doc.text(texto, x, y + 4.5, {
          width: COLUNAS[i].largura - 6,
          align: COLUNAS[i].direita ? 'right' : 'left',
          lineBreak: false,
          // Prende a célula a uma linha: sem isso o texto longo transborda
          // para a linha seguinte e sai cortado pela faixa da próxima locação.
          height: 10,
          ellipsis: true,
        })
        x += COLUNAS[i].largura
      })
      y += 16
    }

    // Rodapé de totais
    doc.rect(32, y, larguraUtil, 18).fill('#f1f5f9')
    doc.fontSize(8).fillColor('#0f172a')
       .text(`${obra.locacoes.length} itens ativos`, 36, y + 5)
       .text(brl(total), 36, y + 5, { width: larguraUtil - 8, align: 'right' })
  }

  if (primeira) {
    doc.fontSize(12).fillColor('#64748b').text('Nenhuma locação ativa no momento.')
  }

  doc.end()
  return pronto
}
