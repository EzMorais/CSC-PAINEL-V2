import { expect, test } from '@playwright/test'
import { ESPERADO, reiniciarBancoGo } from './apoio.go'

/** Entrega de uniforme com assinatura — ver migracao-go/rh/COMPORTAMENTO.md §2. */

test.describe('Uniformes — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('lista as 2 entregas do seed', async ({ page }) => {
    await page.goto('/rh/uniformes')
    await expect(page.getByTestId('lista-entregas').locator('tr, li')).toHaveCount(ESPERADO.entregasUniforme)
  })

  test('registra uma entrega nova com assinatura desenhada no canvas', async ({ page }) => {
    await page.goto('/rh/uniformes')
    await page.getByTestId('nova-entrega').click()
    await page.getByLabel('Funcionário').selectOption({ label: 'ANTÔNIO PEREIRA LIMA' })
    await page.getByLabel('Peça').selectOption('CALCADO')
    await page.getByLabel('Tamanho').fill('41')
    await page.getByLabel('Motivo').selectOption('TROCA')

    const canvas = page.getByTestId('assinatura-canvas')
    const caixa = await canvas.boundingBox()
    if (caixa) {
      await page.mouse.move(caixa.x + 10, caixa.y + 10)
      await page.mouse.down()
      await page.mouse.move(caixa.x + 60, caixa.y + 40)
      await page.mouse.up()
    }

    await page.getByTestId('salvar').click()
    await expect(page.getByText('ANTÔNIO PEREIRA LIMA')).toBeVisible()
  })
})
