import ExcelJS from 'exceljs'
import path from 'node:path'

/**
 * Gera a fixture usada por `e2e/importacao.go.spec.ts` — ver
 * migracao-go/rh/COMPORTAMENTO.md §5. Cabeçalhos escolhidos de propósito para exercitar o
 * reconhecimento por APELIDO (não por posição): "Admissão" com acento, "Obra" em vez de
 * "Centro de custo", nessa ordem específica, diferente da ordem usada em qualquer tela do
 * sistema — se o parser dependesse de posição fixa, este arquivo pegaria o erro.
 *
 * Três linhas, cada uma prova uma regra do §5:
 * 1. NOVO FUNCIONARIO TESTE — obra e cargo que não existem no seed (`EX-9999-26` / `Pintor`):
 *    prova que são criados automaticamente antes do laço de pessoas.
 * 2. JOAO DUPLICADO TESTE — mesmo CPF de JOÃO BATISTA SILVEIRA do seed (529.982.247-25):
 *    prova "existente por CPF é sempre pulado, nunca sobrescrito".
 * 3. SEM DATA TESTE — sem admissão preenchida: prova "linha sem data entra com a data de
 *    hoje, não rejeita a pessoa inteira".
 *
 * Rodar com: npx tsx scripts/gerar-planilha-importacao-exemplo.ts
 */

async function gerar() {
  const wb = new ExcelJS.Workbook()
  const aba = wb.addWorksheet('Funcionários')

  aba.addRow(['Nome Completo', 'C.P.F', 'Admissão', 'Função', 'Obra'])
  aba.addRow(['NOVO FUNCIONARIO TESTE', '123.456.789-09', '2026-01-15', 'Pintor', 'EX-9999-26'])
  aba.addRow(['JOAO DUPLICADO TESTE', '529.982.247-25', '2026-01-15', 'Pedreiro', 'EX-1001-25'])
  aba.addRow(['SEM DATA TESTE', '987.654.321-00', '', 'Servente de obras', 'EX-1001-25'])

  const destino = path.join(__dirname, '../e2e/fixtures/importacao-funcionarios.xlsx')
  await wb.xlsx.writeFile(destino)
  console.log('Gerado em', destino)
}

gerar()
