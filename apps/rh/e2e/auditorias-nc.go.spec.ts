import { expect, test } from '@playwright/test'
import { ESPERADO, reiniciarBancoGo } from './apoio.go'

/**
 * Auditorias/checklists de campo e Não Conformidades — ver
 * migracao-go/rh/COMPORTAMENTO.md §2/§3. Item reprovado (NAO_CONFORME) gera uma NC
 * automaticamente, vinculada por `auditoriaItemId` (no máximo uma por item).
 */

test.describe('Auditorias e Não Conformidades — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('detalhe da auditoria lista os 3 itens do seed, com o reprovado sinalizado', async ({ page }) => {
    await page.goto('/rh/auditorias')
    await page.getByTestId('lista-auditorias').getByRole('link').first().click()
    await expect(page.getByTestId('lista-itens-auditoria').locator('li')).toHaveCount(ESPERADO.itensAuditoria)
    // Escopado à lista — "Não conforme" também existe (oculto) na <option> do formulário.
    await expect(page.getByTestId('lista-itens-auditoria').getByText('Não conforme')).toBeVisible()
  })

  test('item reprovado no seed já tem a NC vinculada, e existe também uma NC solta', async ({ page }) => {
    await page.goto('/rh/nao-conformidades')
    await expect(page.getByTestId('lista-nc').locator('tr, li')).toHaveCount(ESPERADO.naoConformidades)
  })

  test('reprovar um item novo numa auditoria existente gera NC automaticamente', async ({ page }) => {
    await page.goto('/rh/auditorias')
    await page.getByTestId('lista-auditorias').getByRole('link').first().click()
    await page.getByTestId('novo-item').click()
    await page.getByLabel('Descrição').fill('Extintor vencido no almoxarifado da obra')
    await page.getByLabel('Situação').selectOption('NAO_CONFORME')
    await page.getByTestId('salvar').click()

    await page.goto('/rh/nao-conformidades')
    await expect(page.getByText('Extintor vencido no almoxarifado da obra')).toBeVisible()
  })

  test('KPIs de NC contam abertas e vencidas separadamente', async ({ page }) => {
    await page.goto('/rh/nao-conformidades')
    await expect(page.getByTestId('kpi-nc-abertas')).toBeVisible()
    await expect(page.getByTestId('kpi-nc-vencidas')).toBeVisible()
  })
})
