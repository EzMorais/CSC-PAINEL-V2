import PDFDocument from 'pdfkit'
import { prisma } from '@/lib/prisma'
import { STATUS, STATUS_NC } from '@/lib/dominio/constantes'
import { dataLocalBR } from '@/lib/dominio/formato'

async function indicadores() {
  const hoje = new Date()
  const em30dias = new Date(hoje.getTime() + 30 * 86_400_000)

  const [ativos, afastados, ferias, treinamentosVencendo, examesVencendo, ncAbertas, ncVencidas, auditorias] = await Promise.all([
    prisma.funcionario.count({ where: { status: STATUS.ATIVO } }),
    prisma.funcionario.count({ where: { status: STATUS.AFASTADO } }),
    prisma.funcionario.count({ where: { status: STATUS.FERIAS } }),
    prisma.treinamentoParticipante.count({ where: { treinamento: { validadeEm: { lte: em30dias, not: null } } } }),
    prisma.exame.count({ where: { validadeEm: { lte: em30dias, not: null } } }),
    prisma.naoConformidade.count({ where: { status: { not: STATUS_NC.RESOLVIDA } } }),
    prisma.naoConformidade.count({ where: { status: { not: STATUS_NC.RESOLVIDA }, prazo: { lt: hoje } } }),
    prisma.auditoria.count(),
  ])

  return { ativos, afastados, ferias, treinamentosVencendo, examesVencendo, ncAbertas, ncVencidas, auditorias }
}

export async function gerarResumoPdf(): Promise<Buffer> {
  const kpi = await indicadores()

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(18).font('Helvetica-Bold').text('Resumo de RH e SST — Siqueira Campos')
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Emitido em ${dataLocalBR()}`)
    doc.moveDown(1.5)

    const linha = (rotulo: string, valor: number | string) => {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(rotulo, { continued: true })
      doc.font('Helvetica').text(`  ${valor}`)
      doc.moveDown(0.3)
    }

    doc.fontSize(13).font('Helvetica-Bold').text('Efetivo')
    doc.moveDown(0.3)
    linha('Ativos:', kpi.ativos)
    linha('Afastados:', kpi.afastados)
    linha('Em férias:', kpi.ferias)

    doc.moveDown(1)
    doc.fontSize(13).font('Helvetica-Bold').text('Segurança do trabalho')
    doc.moveDown(0.3)
    linha('Treinamentos vencendo em 30 dias:', kpi.treinamentosVencendo)
    linha('Exames (ASO) vencendo em 30 dias:', kpi.examesVencendo)
    linha('Não conformidades em aberto:', kpi.ncAbertas)
    linha('Não conformidades com prazo vencido:', kpi.ncVencidas)
    linha('Auditorias realizadas:', kpi.auditorias)

    doc.end()
  })
}
