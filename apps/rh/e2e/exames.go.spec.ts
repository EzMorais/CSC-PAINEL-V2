import { expect, test } from '@playwright/test'
import { ESPERADO, reiniciarBancoGo } from './apoio.go'

/** ASOs — ver migracao-go/rh/COMPORTAMENTO.md §2/§3. Mesma janela de 30 dias dos treinamentos. */

test.describe('Exames — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('lista os 3 exames do seed', async ({ page }) => {
    await page.goto('/rh/exames')
    await expect(page.getByTestId('contagem-exames')).toHaveText(String(ESPERADO.exames))
  })

  test('alerta mostra o vencido e o vencendo, não o que está fora da janela de 30 dias', async ({ page }) => {
    await page.goto('/rh/exames')
    const alertas = page.getByTestId('alertas-vencimento')
    await expect(alertas).toContainText('PAULO HENRIQUE COSTA') // vencido
    await expect(alertas).toContainText('FERNANDA APARECIDA DIAS') // vencendo em 20 dias
    await expect(alertas).not.toContainText('RAFAEL AUGUSTO MENDES') // vence em 185 dias
  })

  test('registra um exame novo com resultado INAPTO', async ({ page }) => {
    await page.goto('/rh/exames')
    await page.getByTestId('novo-exame').click()
    await page.getByLabel('Funcionário').selectOption({ label: 'CARLOS EDUARDO ROCHA' })
    await page.getByLabel('Tipo').selectOption('PERIODICO')
    await page.getByLabel('Realizado em').fill('2026-08-01')
    await page.getByLabel('Resultado').selectOption('INAPTO')
    await page.getByTestId('salvar').click()
    await expect(page.getByText('CARLOS EDUARDO ROCHA')).toBeVisible()
    await expect(page.getByText('Inapto')).toBeVisible()
  })
})
