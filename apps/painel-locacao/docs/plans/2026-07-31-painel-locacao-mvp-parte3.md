# Painel de Locação SC — Plano de Implementação, Parte 3

> Continuação de `2026-07-31-painel-locacao-mvp-parte2.md`. Comece depois que a Task 17 estiver commitada e `npm run build` passar.

**Esta parte cobre:** Fase 4 — exportação (.xlsx e PDF) · Fase 5 — testes Playwright · Encerramento.

---

# Fase 4 — Exportação

## Task 18: Exportar Excel

**Arquivos:**
- Criar: `src/lib/planilha/exportar-xlsx.ts`, `src/app/api/export/xlsx/route.ts`

O arquivo sai no layout que a equipe reconhece — uma aba por obra, mesmas colunas, bloco `DEVOLUÇÕES` no rodapé. A diferença é que agora ele é gerado a partir do banco, não editado à mão.

- [ ] **Passo 1: Escrever o gerador**

Crie `src/lib/planilha/exportar-xlsx.ts`:

```ts
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { calcularStatus } from '@/lib/dominio/status'
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
      const restantes = l.dataFim && !l.devolvidaEm
        ? Math.round((l.dataFim.getTime() - hoje.getTime()) / 86_400_000)
        : ''

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
```

`ySplit: 5` congela o cabeçalho — sem isso, rolar 74 linhas na aba do MORELLI faz perder de vista qual coluna é qual.

- [ ] **Passo 2: Escrever a rota**

Crie `src/app/api/export/xlsx/route.ts`:

```ts
import { format } from 'date-fns'
import { gerarPlanilha } from '@/lib/planilha/exportar-xlsx'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const buffer = await gerarPlanilha()
    const nome = `locacoes-sc-${format(new Date(), 'yyyy-MM-dd')}.xlsx`

    return new Response(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao gerar a planilha'
    return new Response(JSON.stringify({ erro }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

- [ ] **Passo 3: Verificar o arquivo gerado**

```bash
npm run dev
```

Em outro terminal:

```bash
curl -s -o /tmp/export-sc.xlsx -w "http=%{http_code} bytes=%{size_download}\n" http://localhost:3000/api/export/xlsx
npx tsx -e "
import ExcelJS from 'exceljs'
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile('/tmp/export-sc.xlsx')
console.log('abas:', wb.worksheets.map(w => w.name).join(', '))
for (const ws of wb.worksheets) console.log('  ', ws.name.padEnd(14), 'linhas =', ws.rowCount)
"
```

Esperado: `http=200` com tamanho acima de 20.000 bytes; a listagem mostra `RESUMO` mais uma aba por obra, e a aba `SC-1176-25` com pelo menos 54 linhas de dados. Abra o arquivo no Excel ou Numbers e confirme que as datas aparecem como `31/07/2026` e os valores com `R$`.

- [ ] **Passo 4: Commit**

```bash
git add -A
git commit -m "feat: exportação para Excel com uma aba por obra e bloco de devoluções"
```

---

## Task 19: Exportar PDF

**Arquivos:**
- Criar: `src/lib/planilha/exportar-pdf.ts`, `src/app/api/export/pdf/route.ts`

Relatório de uma página por obra, em paisagem, para imprimir ou anexar em e-mail.

- [ ] **Passo 1: Escrever o gerador**

Crie `src/lib/planilha/exportar-pdf.ts`:

```ts
import PDFDocument from 'pdfkit'
import { prisma } from '@/lib/prisma'
import { brl, dataBR } from '@/lib/dominio/formato'
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
       .text(`Painel de Locação · emitido em ${dataBR(hoje)}`)
    doc.moveDown(0.6)

    doc.fontSize(12).fillColor('#0f172a').text(`${obra.cliente} — ${obra.codigo}`)
    doc.fontSize(9).fillColor('#64748b').text(obra.descricao)
    doc.moveDown(0.5)

    // Cabeçalho da tabela
    let y = doc.y
    doc.rect(32, y, larguraUtil, 18).fill('#0f172a')
    let x = 36
    doc.fontSize(8).fillColor('#ffffff')
    for (const col of COLUNAS) {
      doc.text(col.titulo, x, y + 5, { width: col.largura - 6, align: col.direita ? 'right' : 'left' })
      x += col.largura
    }
    y += 18

    let total = 0
    for (const l of obra.locacoes) {
      // Quebra de página quando falta espaço
      if (y > doc.page.height - 70) {
        doc.addPage()
        y = 40
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
```

- [ ] **Passo 2: Escrever a rota**

Crie `src/app/api/export/pdf/route.ts`:

```ts
import { format } from 'date-fns'
import { gerarPdf } from '@/lib/planilha/exportar-pdf'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const buffer = await gerarPdf()
    const nome = `locacoes-sc-${format(new Date(), 'yyyy-MM-dd')}.pdf`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao gerar o PDF'
    return new Response(JSON.stringify({ erro }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

- [ ] **Passo 3: Verificar**

```bash
curl -s -o /tmp/export-sc.pdf -w "http=%{http_code} bytes=%{size_download}\n" http://localhost:3000/api/export/pdf
open /tmp/export-sc.pdf
```

Esperado: `http=200`, arquivo acima de 10.000 bytes, uma página por obra em paisagem, com as situações coloridas e o total por obra no rodapé.

Se o PDFKit reclamar de fonte (`ENOENT ... Helvetica.afm`) no build de produção, a causa é o empacotamento do Next. Acrescente em `next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfkit'],
}

export default nextConfig
```

- [ ] **Passo 4: Commit**

```bash
git add -A
git commit -m "feat: exportação em PDF com uma página por obra"
```

---

# Fase 5 — Testes automatizados

## Task 20: Configurar o Playwright

**Arquivos:**
- Criar: `playwright.config.ts`, `e2e/apoio.ts`
- Modificar: `package.json`

O banco de teste é separado do de desenvolvimento — os testes recriam e importam do zero, e não podem apagar os dados reais de quem estiver usando o painel.

- [ ] **Passo 1: Instalar**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Passo 2: Escrever a configuração**

Crie `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

const PORTA = 3100
const BASE = `http://localhost:${PORTA}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,

  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    command: `DATABASE_URL="file:./teste.db" npm run dev -- --port ${PORTA}`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: 'file:./teste.db' },
  },
})
```

`workers: 1` e `fullyParallel: false` são obrigatórios: os testes compartilham um único banco SQLite e escrevem nele. Paralelizar aqui produz falhas intermitentes que custam horas para diagnosticar.

- [ ] **Passo 3: Escrever o apoio**

Crie `e2e/apoio.ts`:

```ts
import { execSync } from 'node:child_process'
import path from 'node:path'

export const PLANILHA = path.resolve('dados/Maquinas_Alugadas_Controle_REVISADA.xlsx')

const AMBIENTE = { ...process.env, DATABASE_URL: 'file:./teste.db' }

/** Recria o banco de teste do zero e roda o seed. Não toca no banco de desenvolvimento. */
export function reiniciarBanco() {
  execSync('npx prisma migrate reset --force --skip-generate', { env: AMBIENTE, stdio: 'pipe' })
  execSync('npx tsx prisma/seed.ts', { env: AMBIENTE, stdio: 'pipe' })
}

/** Números conferidos contra a planilha de origem na data do design. */
export const ESPERADO = {
  ativos: 242,
  devolvidos: 61,
  perdidos: 16,
  aConfirmar: 110,
  totalImportado: 303,
}
```

- [ ] **Passo 4: Registrar os scripts**

Em `package.json`, dentro de `"scripts"`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Passo 5: Commit**

```bash
git add -A
git commit -m "chore: configuração do Playwright com banco de teste isolado"
```

---

## Task 21: Teste de importação

**Arquivos:**
- Criar: `e2e/importar.spec.ts`

Este é o teste que prova que o parser não regrediu: qualquer mudança que faça o sistema ler 241 ou 243 itens quebra aqui.

- [ ] **Passo 1: Escrever o teste**

Crie `e2e/importar.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { ESPERADO, PLANILHA, reiniciarBanco } from './apoio'

test.describe('Importação da planilha', () => {
  test.beforeAll(() => reiniciarBanco())

  test('a prévia mostra os totais corretos e não grava nada', async ({ page }) => {
    await page.goto('/importar')
    await page.setInputFiles('#planilha', PLANILHA)
    await page.getByRole('button', { name: 'Analisar' }).click()

    await expect(page.getByText('Prévia — nada foi gravado ainda')).toBeVisible({ timeout: 30_000 })

    const previa = page.locator('dl').first()
    await expect(previa).toContainText(String(ESPERADO.ativos))
    await expect(previa).toContainText(String(ESPERADO.devolvidos))
    await expect(previa).toContainText(String(ESPERADO.perdidos))
    await expect(previa).toContainText(String(ESPERADO.aConfirmar))

    // Nenhum fornecedor novo: os apelidos do seed cobriram todas as grafias da planilha
    await expect(page.getByText(/Fornecedores que serão criados/)).toHaveCount(0)
    await expect(page.getByText(/Linhas não interpretadas/)).toHaveCount(0)

    // Nada foi gravado ainda
    await page.goto('/locacoes')
    await expect(page.getByTestId('contagem')).toContainText('0 itens')
  })

  test('confirmar grava os registros e o dashboard reflete', async ({ page }) => {
    await page.goto('/importar')
    await page.setInputFiles('#planilha', PLANILHA)
    await page.getByRole('button', { name: 'Analisar' }).click()
    await expect(page.getByText('Prévia — nada foi gravado ainda')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /Confirmar importação/ }).click()
    await expect(page.getByText(/Importação concluída/)).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(`${ESPERADO.totalImportado} locações criadas`)).toBeVisible()

    await page.goto('/')
    const kpis = page.getByTestId('kpis')
    await expect(kpis).toContainText(String(ESPERADO.ativos))
    await expect(kpis).toContainText(String(ESPERADO.perdidos))

    await expect(page.getByText(`${ESPERADO.aConfirmar} itens com obra a confirmar.`)).toBeVisible()
  })

  test('reimportar não duplica', async ({ page }) => {
    await page.goto('/importar')
    await page.setInputFiles('#planilha', PLANILHA)
    await page.getByRole('button', { name: 'Analisar' }).click()
    await expect(page.getByText('Prévia — nada foi gravado ainda')).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /Confirmar importação/ }).click()
    await expect(page.getByText('0 locações criadas')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(`${ESPERADO.totalImportado} já existiam`)).toBeVisible()

    await page.goto('/locacoes')
    await expect(page.getByTestId('contagem')).toContainText(`${ESPERADO.ativos} itens`)
  })
})
```

- [ ] **Passo 2: Rodar**

```bash
npm run test:e2e -- importar
```

Esperado: 3 testes passando. Se o primeiro falhar em "0 itens", a importação está gravando antes da confirmação — um bug sério, corrija antes de seguir.

- [ ] **Passo 3: Commit**

```bash
git add -A
git commit -m "test: importação com verificação de totais e idempotência"
```

---

## Task 22: Teste do ciclo de vida

**Arquivos:**
- Criar: `e2e/ciclo-vida.spec.ts`

Registrar → renovar → transferir → devolver, conferindo o histórico a cada etapa. É o teste que garante que a informação perdida na planilha agora sobrevive.

- [ ] **Passo 1: Escrever o teste**

Crie `e2e/ciclo-vida.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { reiniciarBanco } from './apoio'

const EQUIPAMENTO = 'BETONEIRA DE TESTE 400L'

test.describe('Ciclo de vida de uma locação', () => {
  test.beforeAll(() => reiniciarBanco())
  test.describe.configure({ mode: 'serial' })

  test('registrar cria a locação com movimentação de registro', async ({ page }) => {
    await page.goto('/locacoes/nova')

    await page.getByLabel('Obra *').selectOption({ index: 1 })
    await page.getByLabel('Equipamento *').fill(EQUIPAMENTO)
    await page.getByLabel('Código Tr').fill('TESTE-001')
    await page.getByLabel('Fornecedor').selectOption({ index: 1 })
    await page.getByLabel('Valor do item (R$)').fill('650')
    await page.getByLabel('Período rápido').selectOption('30')

    await page.getByRole('button', { name: 'Registrar locação' }).click()
    await page.waitForURL('**/locacoes')

    await expect(page.getByText(EQUIPAMENTO)).toBeVisible()

    await page.getByRole('button', { name: EQUIPAMENTO }).click()
    const drawer = page.getByTestId('drawer-locacao')
    await expect(drawer).toBeVisible()
    await expect(drawer).toContainText('R$ 650,00')

    await drawer.getByRole('tab', { name: /Histórico/ }).click()
    await expect(page.getByTestId('historico')).toContainText('Registrada de')
  })

  test('renovar estende o prazo e registra no histórico', async ({ page }) => {
    await page.goto('/locacoes')
    await page.getByRole('button', { name: EQUIPAMENTO }).click()

    const drawer = page.getByTestId('drawer-locacao')
    await drawer.getByRole('button', { name: 'Renovar' }).click()

    const dialog = page.getByTestId('dialog-renovar')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Dias a acrescentar').fill('15')
    await dialog.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: EQUIPAMENTO }).click()
    await page.getByTestId('drawer-locacao').getByRole('tab', { name: /Histórico/ }).click()
    await expect(page.getByTestId('historico')).toContainText('Renovada por 15 dias')
  })

  test('transferir muda a obra e registra origem e destino', async ({ page }) => {
    await page.goto('/locacoes')
    await page.getByRole('button', { name: EQUIPAMENTO }).click()

    const drawer = page.getByTestId('drawer-locacao')
    const obraOriginal = (await drawer.locator('p').first().textContent()) ?? ''

    await drawer.getByRole('button', { name: 'Transferir' }).click()
    const dialog = page.getByTestId('dialog-transferir')
    await dialog.getByLabel('Obra de destino *').selectOption({ index: 3 })
    await dialog.getByLabel('Fim *').fill('2026-12-31')
    await dialog.getByLabel('Motivo').fill('teste automatizado')
    await dialog.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: EQUIPAMENTO }).click()
    const novoDrawer = page.getByTestId('drawer-locacao')
    await expect(novoDrawer.locator('p').first()).not.toHaveText(obraOriginal)

    await novoDrawer.getByRole('tab', { name: /Histórico/ }).click()
    await expect(page.getByTestId('historico')).toContainText('Transferida de')
    await expect(page.getByTestId('historico')).toContainText('teste automatizado')
  })

  test('devolver preserva a data de início e calcula os dias na obra', async ({ page }) => {
    await page.goto('/locacoes')
    await page.getByRole('button', { name: EQUIPAMENTO }).click()

    const drawer = page.getByTestId('drawer-locacao')
    await drawer.getByRole('button', { name: 'Devolver' }).click()

    const dialog = page.getByTestId('dialog-devolver')
    await dialog.getByLabel('Motivo').fill('fim da obra')
    await dialog.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dialog).toBeHidden()

    // Some da lista padrão
    await expect(page.getByText(EQUIPAMENTO)).toHaveCount(0)

    // Aparece no filtro de devolvidas, com o histórico completo
    await page.goto('/locacoes?status=DEVOLVIDA')
    await page.getByRole('button', { name: EQUIPAMENTO }).click()
    await page.getByTestId('drawer-locacao').getByRole('tab', { name: /Histórico/ }).click()

    const historico = page.getByTestId('historico')
    await expect(historico).toContainText('permaneceu')
    await expect(historico).toContainText('dias na obra')
    await expect(historico).toContainText('fim da obra')

    // As quatro etapas continuam registradas
    await expect(historico).toContainText('Registrada de')
    await expect(historico).toContainText('Renovada por 15 dias')
    await expect(historico).toContainText('Transferida de')
  })

  test('devolvida não oferece mais ações', async ({ page }) => {
    await page.goto('/locacoes?status=DEVOLVIDA')
    await page.getByRole('button', { name: EQUIPAMENTO }).click()
    const drawer = page.getByTestId('drawer-locacao')
    await expect(drawer.getByRole('button', { name: 'Renovar' })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: 'Devolver' })).toHaveCount(0)
  })
})
```

A última asserção do quarto teste é o coração de tudo: as quatro etapas continuam legíveis no histórico depois da devolução. Na planilha, esse item já teria sido apagado e recriado no bloco `DEVOLUÇÕES` com a data de início sobrescrita.

- [ ] **Passo 2: Rodar**

```bash
npm run test:e2e -- ciclo-vida
```

Esperado: 5 testes passando.

- [ ] **Passo 3: Commit**

```bash
git add -A
git commit -m "test: ciclo de vida completo com verificação de histórico"
```

---

## Task 23: Teste de responsividade

**Arquivos:**
- Criar: `e2e/responsivo.spec.ts`
- Modificar: `playwright.config.ts`

Trava a responsividade contra regressão nos três tamanhos que importam: celular na obra, tablet no escritório e desktop.

- [ ] **Passo 1: Acrescentar os projetos de viewport**

Em `playwright.config.ts`, substitua o array `projects` por:

```ts
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet',  use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
```

- [ ] **Passo 2: Escrever o teste**

Crie `e2e/responsivo.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import { ESPERADO, PLANILHA, reiniciarBanco } from './apoio'

const PAGINAS = ['/', '/locacoes', '/locacoes/nova', '/obras', '/fornecedores', '/importar']

async function semRolagemHorizontal(page: Page) {
  const excedente = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(excedente, 'a página não deve rolar horizontalmente').toBeLessThanOrEqual(1)
}

test.describe('Responsividade', () => {
  test.beforeAll(async ({ browser }) => {
    reiniciarBanco()
    const page = await browser.newPage()
    await page.goto('/importar')
    await page.setInputFiles('#planilha', PLANILHA)
    await page.getByRole('button', { name: 'Analisar' }).click()
    await page.getByRole('button', { name: /Confirmar importação/ }).click()
    await page.getByText(/Importação concluída/).waitFor({ timeout: 60_000 })
    await page.close()
  })

  for (const caminho of PAGINAS) {
    test(`${caminho} não rola horizontalmente`, async ({ page }) => {
      await page.goto(caminho)
      await page.waitForLoadState('networkidle')
      await semRolagemHorizontal(page)
    })
  }

  test('a navegação se adapta ao tamanho da tela', async ({ page }, testInfo) => {
    await page.goto('/')
    const menu = page.getByRole('button', { name: 'Abrir menu' })

    if (testInfo.project.name === 'desktop') {
      await expect(menu).toBeHidden()
      await expect(page.getByTestId('navegacao')).toBeVisible()
    } else {
      await expect(menu).toBeVisible()
      await menu.click()
      await expect(page.getByTestId('navegacao')).toBeVisible()
      await page.getByRole('link', { name: 'Locações' }).click()
      await page.waitForURL('**/locacoes')
    }
  })

  test('a listagem usa cards no celular e tabela no desktop', async ({ page }, testInfo) => {
    await page.goto('/locacoes')

    if (testInfo.project.name === 'celular') {
      await expect(page.getByTestId('lista-cards')).toBeVisible()
      await expect(page.getByTestId('tabela-locacoes')).toBeHidden()
    } else if (testInfo.project.name === 'desktop') {
      await expect(page.getByTestId('tabela-locacoes')).toBeVisible()
      await expect(page.getByTestId('lista-cards')).toBeHidden()
    }
  })

  test('os indicadores aparecem em qualquer tamanho', async ({ page }) => {
    await page.goto('/')
    const kpis = page.getByTestId('kpis')
    await expect(kpis).toBeVisible()
    await expect(kpis).toContainText(String(ESPERADO.ativos))
    await semRolagemHorizontal(page)
  })

  test('o drawer de detalhe ocupa a tela inteira no celular', async ({ page }, testInfo) => {
    await page.goto('/locacoes')

    const alvo = testInfo.project.name === 'celular'
      ? page.getByTestId('lista-cards').getByRole('button').first()
      : page.getByTestId('tabela-locacoes').locator('tbody button').first()

    await alvo.click()
    const drawer = page.getByTestId('drawer-locacao')
    await expect(drawer).toBeVisible()

    const caixa = await drawer.boundingBox()
    const larguraTela = page.viewportSize()!.width
    if (testInfo.project.name === 'celular') {
      expect(caixa!.width).toBeGreaterThanOrEqual(larguraTela - 2)
    } else {
      expect(caixa!.width).toBeLessThan(larguraTela * 0.6)
    }
  })
})
```

- [ ] **Passo 3: Rodar a suíte completa**

```bash
npm run test:e2e
```

Esperado: os três projetos passando. Se `não rola horizontalmente` falhar em `/locacoes` no celular, a causa quase sempre é a tabela do desktop não estando de fato escondida — confira o `hidden lg:block` no contêiner.

- [ ] **Passo 4: Commit**

```bash
git add -A
git commit -m "test: responsividade em 390, 768 e 1440 com verificação de rolagem horizontal"
```

---

## Task 24: README e fechamento

**Arquivos:**
- Criar: `README.md`
- Modificar: `package.json`

- [ ] **Passo 1: Escrever o README**

Crie `README.md`:

````markdown
# Painel de Locação — Construtora Siqueira Campos

Controle de equipamentos locados por obra. Substitui o painel em Tkinter que usava
uma planilha Excel como banco de dados.

## Rodar

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Abre em `http://localhost:3000`.

## Carregar os dados

Coloque a planilha de controle em `dados/` e acesse `/importar`. O sistema mostra o que
entendeu antes de gravar qualquer coisa, e reimportar não duplica registros.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento |
| `npm run build` | Compila para produção |
| `npm run db:seed` | Cadastra obras e fornecedores |
| `npm run db:reset` | Apaga o banco e recadastra do zero |
| `npm run verificar:planilha` | Confere o parser contra a planilha de origem |
| `npm run test:e2e` | Roda os testes Playwright |

## Como funciona

O banco SQLite (`prisma/dev.db`) é a fonte da verdade. O Excel entra pelo importador e
sai pelo exportador — não é mais editado à mão.

**Status não é campo gravado.** É calculado a partir de `dataFim` e `devolvidaEm` toda vez
que a tela é montada. Um item vence sozinho, sem ninguém precisar atualizar nada.

**Devolver não apaga.** A locação muda de status e ganha uma movimentação no histórico.
A data de início original sobrevive, o que permite saber quanto tempo cada equipamento
realmente ficou na obra — informação que a planilha destruía.

**Apelidos de fornecedor** existem porque a planilha escreve `KAISEN` onde o cadastro diz
`KAISEN LOCAÇÕES`. Sem eles, cada grafia viraria um fornecedor diferente nos indicadores.

## O que não vai para o Git

O banco (`*.db`), as planilhas (`dados/`) e os exports. São dados financeiros de obra.
O repositório leva o schema, as migrations e o seed — o suficiente para qualquer pessoa
subir o sistema do zero.

## Documentos

- `docs/plans/2026-07-31-painel-locacao-design.md` — decisões de arquitetura e o que a
  análise da planilha original revelou
- `docs/plans/2026-07-31-painel-locacao-mvp*.md` — plano de implementação
````

- [ ] **Passo 2: Rodar tudo uma última vez**

```bash
npm run lint && npm run build && npm run test:e2e
```

Esperado: lint limpo, build concluída, todos os testes passando nos três viewports.

- [ ] **Passo 3: Commit**

```bash
git add -A
git commit -m "docs: README com instruções de uso e decisões do sistema"
```

- [ ] **Passo 4: Subir para o GitHub**

```bash
gh repo create siqueiracampos-painellocacao --private --source=. --remote=origin --push
```

Se preferir criar o repositório pela interface do GitHub, use:

```bash
git remote add origin git@github.com:<usuario>/siqueiracampos-painellocacao.git
git push -u origin main
```

Confirme depois do push que a planilha não subiu:

```bash
git ls-files | grep -i xlsx
```

Esperado: nenhuma saída.

---

# Cobertura do plano contra o design

| Requisito do design | Onde é implementado |
|---|---|
| Banco como fonte da verdade, Excel como saída | Tasks 2, 9, 18, 19 |
| Obra como entidade real (resolve TOYOTA/MORELLI) | Tasks 3, 7, 16 (lote), 17 |
| Coluna 15 separada em quantidade/estado/observação | Task 6 |
| Fornecedores normalizados por apelido | Tasks 3, 9, 17 |
| Telefones e responsáveis vindos do RESUMO | Task 3 |
| Devolver preserva a data de início | Task 15, verificado na Task 22 |
| Status derivado, nunca digitado | Task 4, usado em 12, 13, 14 |
| KPI de itens perdidos | Tasks 12, 13 |
| Histórico auditável de movimentações | Tasks 2, 15, verificado na Task 22 |
| Importador com prévia e linhas não interpretadas | Tasks 9, 10 |
| Reimportação idempotente | Task 9, verificado na Task 21 |
| Light por padrão + toggle dark | Task 11 |
| Cards no mobile, tabela no desktop | Tasks 14, 23 |
| CRUD de obras e fornecedores | Task 17 |
| Export .xlsx e PDF | Tasks 18, 19 |
| E2E dos fluxos críticos | Tasks 21, 22 |
| Responsividade em 390/768/1440 | Task 23 |
| Erros exibidos, nunca engolidos | Todas as actions retornam `{ ok, erro }` |

## Dívidas conhecidas, deliberadas

- **Busca sensível a maiúsculas.** O SQLite no Prisma não aceita `mode: 'insensitive'`.
  Como as descrições são gravadas em caixa alta, não incomoda na prática. Se incomodar,
  a saída é uma coluna `descricaoBusca` normalizada.
- **Valores monetários em `Float`.** O erro de arredondamento em somas desta ordem de
  grandeza é da ordem de 10⁻¹⁰ — irrelevante para exibição. Se um dia entrar conciliação
  contábil, migre para centavos em `Int`.
- **Sem autenticação.** Decisão do design: o sistema roda local. Quando virar rede,
  entra Auth.js e o campo `autor` nas movimentações — o schema já comporta.
- **Sem testes unitários.** Escopo acordado foi E2E + responsividade. Os scripts
  `verificar-*.ts` cobrem as funções puras com feedback rápido, e o `importar.spec.ts`
  cobre o parser de ponta a ponta.
