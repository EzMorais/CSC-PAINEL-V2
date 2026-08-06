import { expect, test } from '@playwright/test'
import { ESPERADO, reiniciarBancoGo } from './apoio.go'

/**
 * Documentos — empresa/obra e pessoal, com versionamento — ver
 * migracao-go/rh/COMPORTAMENTO.md §2/§3.
 */

test.describe('Documentos — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('lista os 3 documentos do seed, empresa e pessoal juntos', async ({ page }) => {
    await page.goto('/rh/documentos')
    await expect(page.getByTestId('lista-documentos').locator('tr, li')).toHaveCount(ESPERADO.documentos)
    await expect(page.getByText('PGR')).toBeVisible()
    await expect(page.getByText('PCMSO')).toBeVisible()
  })

  test('reenviar um documento com o mesmo título/categoria/obra cria versão 2, não sobrescreve', async ({
    page,
  }) => {
    await page.goto('/rh/documentos')
    await page.getByText('PGR').click()
    await page.getByTestId('nova-versao').click()
    await page.getByLabel('Vigente desde').fill('2026-08-01')
    await page.getByTestId('salvar').click()

    await expect(page.getByTestId('versao-atual')).toHaveText('2')
    // As duas versões continuam existindo, não é update-in-place.
    await expect(page.getByTestId('lista-versoes').locator('li')).toHaveCount(2)
  })

  test('documento vinculado a funcionário aparece no checklist pessoal dele', async ({ page }) => {
    await page.goto('/rh/funcionarios')
    await page.getByText('PAULO HENRIQUE COSTA').click()
    await expect(page.getByTestId('checklist-documentos')).toContainText('RG')
  })
})
