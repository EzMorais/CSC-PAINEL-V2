import { expect, test, type Page } from '@playwright/test'
import { reiniciarBancoGo } from './apoio.go'

/**
 * Cadastro de material + o livro-razão de movimentações — contra o Almoxarifado em Go. Ver
 * migracao-go/estoque/COMPORTAMENTO.md §3 e §5.
 *
 * O que este arquivo protege: saldo NUNCA é gravado, é sempre somado a partir das
 * movimentações (por isso o material nasce com saldo 0 e cada passo confere o saldo
 * recalculado); saída maior que o saldo é recusada; ajuste de inventário dentro do limite
 * (padrão 10) aplica direto, sem passar por aprovação.
 *
 * Interação diferente do Next.js original de propósito: sem drawer — clicar no material
 * NAVEGA pra uma página de detalhe de verdade, e Movimentar/Ajustar são formulários
 * expansíveis (<details>) na própria página, mesmo padrão do Painel de Locação em Go.
 */

const NOME_MATERIAL = 'PARAFUSO SEXTAVADO GO TESTE'

let MATERIAL_URL = ''

async function abrirMaterial(page: Page) {
  await page.goto('/almoxarifado/materiais')
  await page.getByRole('link', { name: new RegExp(NOME_MATERIAL) }).click()
  await expect(page.getByRole('heading', { name: NOME_MATERIAL })).toBeVisible()
}

test.describe('Materiais e movimentações — Go', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('cria material e nasce com saldo zero (Sem estoque)', async ({ page }) => {
    await page.goto('/almoxarifado/materiais')
    await page.getByTestId('novo-material').click()
    await page.getByLabel('Nome *').fill(NOME_MATERIAL)
    await page.getByLabel('Categoria *').selectOption('ACO_FERRAGEM')
    await page.getByLabel('Unidade *').selectOption('UN')
    await page.getByLabel('Estoque mínimo').fill('50')
    await page.getByTestId('salvar-material').click()
    await page.waitForURL('**/almoxarifado/materiais')

    await abrirMaterial(page)
    MATERIAL_URL = page.url()

    await expect(page.getByTestId('saldo-material')).toHaveText('0 UN')
    await expect(page.getByTestId('situacao-material')).toContainText('Sem estoque')
  })

  test('registrar entrada aumenta o saldo', async ({ page }) => {
    await page.goto(MATERIAL_URL)
    await page.getByTestId('abrir-movimentar').click()
    await page.locator('#tipo').selectOption('ENTRADA')
    await page.locator('#quantidade').fill('100')
    await page.locator('#valorUnitario').fill('10')
    await page.getByTestId('confirmar-movimentar').click()
    await page.waitForURL(MATERIAL_URL)

    await expect(page.getByTestId('saldo-material')).toHaveText('100 UN')
    // 100 acima do mínimo (50) — situação normal.
    await expect(page.getByTestId('situacao-material')).toContainText('Normal')
  })

  test('saída maior que o saldo é recusada', async ({ page }) => {
    await page.goto(MATERIAL_URL)
    await page.getByTestId('abrir-movimentar').click()
    await page.locator('#tipo').selectOption('SAIDA')
    await page.locator('#quantidade').fill('999')
    await page.locator('#obraId').selectOption({ index: 1 })
    await page.getByTestId('confirmar-movimentar').click()

    await expect(page.locator('.erro')).toContainText('Saldo insuficiente')
    // Nada mudou: saída inválida não grava movimentação nenhuma.
    await expect(page.getByTestId('saldo-material')).toHaveText('100 UN')
  })

  test('saída dentro do saldo é aceita e desconta', async ({ page }) => {
    await page.goto(MATERIAL_URL)
    await page.getByTestId('abrir-movimentar').click()
    await page.locator('#tipo').selectOption('SAIDA')
    await page.locator('#quantidade').fill('20')
    await page.locator('#obraId').selectOption({ index: 1 })
    await page.getByTestId('confirmar-movimentar').click()
    await page.waitForURL(MATERIAL_URL)

    await expect(page.getByTestId('saldo-material')).toHaveText('80 UN')
    await expect(page.getByTestId('historico-material')).toContainText('Saída para obra')
  })

  test('ajuste de inventário dentro do limite aplica direto, sem aprovação', async ({ page }) => {
    await page.goto(MATERIAL_URL)
    await page.getByTestId('abrir-ajustar').click()
    // 80 -> 88: diferença de 8, dentro do limite padrão (10) — aplica na hora.
    await page.locator('#quantidadeContada').fill('88')
    await page.getByTestId('confirmar-ajustar').click()
    await page.waitForURL(MATERIAL_URL)

    await expect(page.getByTestId('saldo-material')).toHaveText('88 UN')
    await expect(page.getByTestId('historico-material')).toContainText('Ajuste de inventário (sobra)')
  })

  test('alternar inativa o material', async ({ page }) => {
    await page.goto(MATERIAL_URL)
    await page.getByTestId('alternar-material').click()
    await page.waitForURL(MATERIAL_URL)
    await expect(page.getByText('inativo')).toBeVisible()
  })
})
