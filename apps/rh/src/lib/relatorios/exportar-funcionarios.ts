import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { ROTULO_STATUS, type Status } from '@/lib/dominio/constantes'
import { dataBR } from '@/lib/dominio/formato'

const CABECALHOS = ['Matrícula', 'Nome', 'CPF', 'Obra', 'Cargo', 'Situação', 'Admissão', 'Telefone', 'Cidade', 'UF']
const LARGURAS = [12, 32, 16, 14, 22, 12, 14, 16, 18, 6]

function estilizarCabecalho(linha: ExcelJS.Row) {
  linha.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  linha.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  linha.height = 24
}

/**
 * `comDados: false` gera a mesma planilha, mesmas colunas, sem nenhuma linha — o modelo
 * que alguém preenche e devolve. Mesma função pros dois casos de propósito: o modelo e o
 * relatório real não podem divergir de coluna, senão o modelo mente sobre o formato
 * esperado.
 */
export async function gerarPlanilhaFuncionarios(comDados: boolean): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'RH e SST — Siqueira Campos'
  wb.created = new Date()

  const aba = wb.addWorksheet('FUNCIONÁRIOS')
  aba.columns = CABECALHOS.map((header, i) => ({ header, width: LARGURAS[i] }))
  estilizarCabecalho(aba.getRow(1))

  if (comDados) {
    const funcionarios = await prisma.funcionario.findMany({
      orderBy: [{ status: 'asc' }, { nome: 'asc' }],
      include: { obra: { select: { codigo: true } }, cargo: { select: { nome: true } } },
    })

    for (const f of funcionarios) {
      aba.addRow([
        f.matricula, f.nome, f.cpf, f.obra?.codigo ?? '', f.cargo?.nome ?? '',
        ROTULO_STATUS[f.status as Status] ?? f.status, dataBR(f.admitidoEm),
        f.telefone ?? '', f.cidade ?? '', f.uf ?? '',
      ])
    }
  }

  return wb.xlsx.writeBuffer()
}
