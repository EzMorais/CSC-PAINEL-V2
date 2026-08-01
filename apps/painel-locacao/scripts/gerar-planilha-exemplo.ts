/**
 * Gera uma planilha de exemplo no mesmo formato da que a construtora usa.
 *
 * Existe porque a planilha real não entra no controle de versão: ela tem custo de obra de
 * uma empresa. Sem um arquivo de exemplo, quem clona o repositório não consegue exercitar
 * o importador, que é metade do sistema.
 *
 * O arquivo gerado reproduz de propósito as peculiaridades que tornam a planilha real
 * difícil de ler, para que o importador seja testado contra elas e não contra um caso
 * ideal que não existe na prática:
 *
 *   - cabeçalho "Nº" em linha variável (linha 3 na maioria das abas, linha 8 em uma)
 *   - bloco DEVOLUÇÕES no rodapé, depois de LEGENDA e do link "Voltar ao Resumo"
 *   - coluna 15 com três coisas empilhadas: quantidade, estado do item e texto livre
 *   - uma aba compartilhada por duas obras (itens entram como "obra a confirmar")
 *   - o mesmo equipamento repetido em abas diferentes (possível duplicata)
 *   - linhas sem data e linhas sem fornecedor, que existem aos montes no arquivo real
 *
 * Uso: npm run gerar:exemplo
 */

import ExcelJS from 'exceljs'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'

const CABECALHOS = [
  'Nº', 'DESCRIÇÃO DO EQUIPAMENTO', 'Tr Código', 'INÍCIO LOCAÇÃO', 'FIM LOCAÇÃO',
  'DIAS TOTAIS', 'DIAS RESTANTES', 'BARRA DE VALIDADE', 'STATUS', 'QUAL PERIODO?',
  'PERIODOS', 'VALOR DO ITEM', 'VALOR GASTO TOTAL', 'FORNECEDOR', 'UNIDADES',
]

const EQUIPAMENTOS = [
  ['MARTELETE 11KG', 650], ['BETONEIRA 400 LITROS', 350], ['ANDAIME TUBULAR', 45],
  ['COMPACTADOR GASOLINA', 900], ['GERADOR 6KVA', 1200], ['PLATAFORMA ARTICULADA', 4800],
  ['ESCADA EXTENSIVA 9M', 380], ['BOMBA SUBMERSA 2"', 650], ['SERRA CIRCULAR', 220],
  ['VIBRADOR DE CONCRETO', 420], ['CONTAINER 6 METROS', 1550], ['SANITÁRIO QUÍMICO', 780],
  ['ROMPEDOR 17KG', 1310], ['LAVADORA ALTA PRESSÃO', 600], ['ASPIRADOR INDUSTRIAL', 750],
] as const

const FORNECEDORES = [
  'MAQLOC', 'ANDAIMES CENTRAL', 'UNIAO', 'CACAMBAS', 'ELEVA',
  'GERADORES', 'SANITARIOS', 'COMPRESSORES',
] as const

/** Abas do arquivo. `linhaCabecalho` varia de propósito — o parser precisa localizá-lo. */
const ABAS = [
  { nome: 'EX-1001-25_ALFA', titulo: 'ALFA INDUSTRIAL — EX-1001-25', linhaCabecalho: 3, ativos: 14, devolvidos: 4 },
  { nome: 'EX-1002-25_ALFA', titulo: 'ALFA INDUSTRIAL — EX-1002-25', linhaCabecalho: 3, ativos: 6,  devolvidos: 2 },
  { nome: 'EX-1010-25_BETA', titulo: 'BETA LOGÍSTICA — EX-1010-25 (duas obras)', linhaCabecalho: 8, ativos: 18, devolvidos: 5 },
  { nome: 'EX-1020-26_GAMA', titulo: 'GAMA ALIMENTOS — EX-1020-26', linhaCabecalho: 3, ativos: 10, devolvidos: 3 },
  { nome: 'AVULSO',          titulo: 'Controle avulso', linhaCabecalho: 3, ativos: 4, devolvidos: 1 },
] as const

/** Gerador determinístico: rodar duas vezes produz o mesmo arquivo. */
function criarSorteio(semente: number) {
  let estado = semente
  return (max: number) => {
    estado = (estado * 1103515245 + 12345) % 2147483648
    return estado % max
  }
}

function dataUTC(base: Date, deslocamentoDias: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + deslocamentoDias)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function main() {
  const sortear = criarSorteio(20260801)
  const hoje = new Date()
  const base = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Painel de Locação SC — gerador de exemplo'

  const resumo = wb.addWorksheet('RESUMO')
  resumo.addRow(['CONTROLE DE MÁQUINAS ALUGADAS — DADOS DE EXEMPLO']).font = { bold: true, size: 14 }
  resumo.addRow([])
  resumo.addRow(['CLIENTE', 'Nº OBRA', 'DESCRIÇÃO DA OBRA', 'IR PARA ABA', 'RESPONSAVEL']).font = { bold: true }
  resumo.addRow(['ALFA INDUSTRIAL', 'EX-1001-25', 'CONSTRUÇÃO DE GALPÃO', 'Abrir obra ▸', 'ana'])
  resumo.addRow(['', 'EX-1002-25', 'REDE DE DRENAGEM', 'Abrir obra ▸', ''])
  resumo.addRow(['BETA LOGÍSTICA', 'EX-1010-25A', 'PRÉDIO ADMINISTRATIVO', 'Abrir obra ▸', 'bruno'])
  resumo.addRow(['', 'EX-1010-25B', 'DOCA DE CARREGAMENTO', 'Abrir obra ▸', ''])
  resumo.addRow(['GAMA ALIMENTOS', 'EX-1020-26', 'AMPLIAÇÃO DA FÁBRICA', 'Abrir obra ▸', 'carla'])
  resumo.columns = [{ width: 20 }, { width: 14 }, { width: 34 }, { width: 14 }, { width: 14 }]

  // Guardado para repetir em outra aba: é assim que a duplicata entre abas aparece no
  // arquivo real, e o importador precisa sinalizá-la em vez de descartar.
  let itemParaRepetir: (string | number | Date | null)[] | null = null

  let total = 0
  let devolvidosTotal = 0

  for (const aba of ABAS) {
    const ws = wb.addWorksheet(aba.nome)

    ws.getCell('G1').value = 'DATA ATUAL:'
    ws.getCell('I1').value = base
    ws.getCell('A2').value = 'LOCAÇÕES'
    ws.getCell('A2').font = { bold: true }
    if (aba.linhaCabecalho === 8) {
      ws.getCell('A4').value = aba.titulo
      ws.getCell('A5').value = 'Aba compartilhada por duas obras — os itens entram como "obra a confirmar"'
      ws.getCell('A7').value = 'LOCAÇÕES'
    }

    const cab = ws.getRow(aba.linhaCabecalho)
    CABECALHOS.forEach((t, i) => (cab.getCell(i + 1).value = t))
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    ws.columns = [
      { width: 6 }, { width: 34 }, { width: 12 }, { width: 14 }, { width: 14 },
      { width: 11 }, { width: 13 }, { width: 13 }, { width: 11 }, { width: 13 },
      { width: 10 }, { width: 13 }, { width: 16 }, { width: 22 }, { width: 14 },
    ]

    let linha = aba.linhaCabecalho + 1
    for (let i = 0; i < aba.ativos; i++) {
      const [desc, valor] = EQUIPAMENTOS[sortear(EQUIPAMENTOS.length)]
      const inicio = dataUTC(base, -sortear(90) - 1)
      const fim = dataUTC(inicio, [7, 15, 30, 30, 60][sortear(5)])

      // Uma em cada sete linhas fica sem datas, e uma em cada nove sem fornecedor:
      // o arquivo real tem 6 e 39 casos assim, e o importador não pode engasgar.
      const semDatas = i % 7 === 3
      const semFornecedor = i % 9 === 5

      // Coluna 15 com os três usos empilhados, como no arquivo real.
      const col15 = i % 5 === 0 ? sortear(8) + 1
        : i % 11 === 4 ? 'PERDIDO'
        : i % 13 === 7 ? 'ok'
        : i % 17 === 9 ? 'CONFERIR NO CANTEIRO'
        : null

      const dados = [
        i + 1, desc, `TR${1000 + sortear(9000)}`,
        semDatas ? null : inicio, semDatas ? null : fim,
        null, null, null, null, null, null,
        valor, null,
        semFornecedor ? null : FORNECEDORES[sortear(FORNECEDORES.length)],
        col15,
      ]
      ws.getRow(linha).values = dados
      ws.getRow(linha).getCell(4).numFmt = 'DD/MM/YYYY'
      ws.getRow(linha).getCell(5).numFmt = 'DD/MM/YYYY'
      ws.getRow(linha).getCell(12).numFmt = 'R$ #,##0.00'

      if (aba.nome === 'EX-1001-25_ALFA' && i === 2) itemParaRepetir = dados
      linha++
      total++
    }

    // O mesmo equipamento, com Tr e valor idênticos, repetido em outra aba.
    if (aba.nome === 'EX-1010-25_BETA' && itemParaRepetir) {
      ws.getRow(linha).values = [...itemParaRepetir]
      ws.getRow(linha).getCell(4).numFmt = 'DD/MM/YYYY'
      ws.getRow(linha).getCell(5).numFmt = 'DD/MM/YYYY'
      linha++
      total++
    }

    linha++
    ws.getCell(`A${linha}`).value = 'LEGENDA:'
    ws.getCell(`B${linha}`).value = ' ATIVA '
    ws.getCell(`C${linha}`).value = 'Mais de 7 dias restantes'
    ws.getCell(`D${linha}`).value = ' ATENÇÃO '
    ws.getCell(`E${linha}`).value = '7 dias ou menos para o vencimento'
    ws.getCell(`F${linha}`).value = ' VENCIDA '
    ws.getCell(`G${linha}`).value = 'Prazo de locação já encerrado'
    linha += 2
    ws.getCell(`A${linha}`).value = '◂ Voltar ao Resumo'
    linha += 2

    ws.getCell(`A${linha}`).value = 'DEVOLUÇÕES'
    ws.getCell(`A${linha}`).font = { bold: true }
    linha++
    for (let i = 0; i < aba.devolvidos; i++) {
      const [desc, valor] = EQUIPAMENTOS[sortear(EQUIPAMENTOS.length)]
      const inicio = dataUTC(base, -sortear(120) - 30)
      // Início igual ao fim reproduz o defeito do arquivo real: ao devolver, o app antigo
      // sobrescrevia a data de início e o tempo de permanência se perdia.
      ws.getRow(linha).values = [
        null, desc, `TR${1000 + sortear(9000)}`, inicio, inicio,
        null, null, null, null, 'Mensal', 2, valor, valor * 2,
        FORNECEDORES[sortear(FORNECEDORES.length)], null,
      ]
      ws.getRow(linha).getCell(4).numFmt = 'DD/MM/YYYY'
      ws.getRow(linha).getCell(5).numFmt = 'DD/MM/YYYY'
      linha++
      devolvidosTotal++
    }

    ws.views = [{ state: 'frozen', ySplit: aba.linhaCabecalho }]
  }

  await mkdir('dados', { recursive: true })
  const destino = path.join('dados', 'EXEMPLO_Maquinas_Alugadas.xlsx')
  await wb.xlsx.writeFile(destino)

  console.log(`Planilha de exemplo gerada: ${destino}`)
  console.log(`  ${ABAS.length} abas de obra + RESUMO`)
  console.log(`  ${total} locações ativas, ${devolvidosTotal} devolvidas`)
  console.log('\nImporte em http://localhost:3000/importar')
}

main()
