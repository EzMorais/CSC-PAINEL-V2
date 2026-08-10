import { expect, test } from '@playwright/test'
import { ESPERADO, reiniciarBancoGo } from './apoio.go'

/**
 * Indicadores do dashboard — contra o RH em Go. Ver migracao-go/rh/COMPORTAMENTO.md §8 e o
 * seed em cmd/seed/main.go `semearRH`. Números vêm exatamente do seed (ver apoio.go.ts
 * `ESPERADO`): 14 funcionários (11 ativos, 1 férias, 1 afastado, 1 desligado).
 */

test.describe('Dashboard — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('KPIs de efetivo batem com o seed', async ({ page }) => {
    await page.goto('/rh')

    await expect(page.getByTestId('kpi-ativos')).toHaveText(String(ESPERADO.ativos))
    await expect(page.getByTestId('kpi-afastados')).toHaveText(String(ESPERADO.afastados))
    await expect(page.getByTestId('kpi-ferias')).toHaveText(String(ESPERADO.ferias))
    await expect(page.getByTestId('kpi-desligados')).toHaveText(String(ESPERADO.desligados))
  })

  test('cadastros incompletos conta quem está sem obra ou sem cargo', async ({ page }) => {
    await page.goto('/rh')
    // DIEGO FERREIRA PINTO é o único sem obra e sem cargo — conta 1 vez, não 2.
    await expect(page.getByTestId('kpi-cadastros-incompletos')).toHaveText('1')
  })

  test('eventos recentes mostra a timeline gerada pelo seed', async ({ page }) => {
    await page.goto('/rh')
    const eventos = page.getByTestId('eventos-recentes').locator('li')
    await expect(eventos.first()).toBeVisible()
  })
})
