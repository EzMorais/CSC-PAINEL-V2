import { expect, test } from '@playwright/test'
import { reiniciarBancoGo } from './apoio.go'

/**
 * Indicadores do dashboard — contra o Almoxarifado em Go. Ver
 * migracao-go/estoque/COMPORTAMENTO.md §8 e o seed em cmd/seed/main.go `semearEstoque`.
 *
 * Os números conferidos aqui vêm exatamente do seed: 5 materiais (Cimento OK, Areia ABAIXO,
 * Arame ZERADO, Capacete EPI OK, Tábua OK), 4 entradas e 2 saídas lançadas na criação, 1
 * aprovação pendente (ajuste do Arame). Valor em estoque = soma do saldo × último preço de
 * cada material com saldo positivo: 200×32,50 + 15×85 + 17×45 + 80×18 = 9.980,00.
 */

test.describe('Dashboard — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('KPIs batem com os dados de exemplo semeados', async ({ page }) => {
    await page.goto('/almoxarifado')

    await expect(page.getByTestId('kpi-total')).toHaveText('5')
    await expect(page.getByTestId('kpi-sem-estoque')).toHaveText('1')
    await expect(page.getByTestId('kpi-abaixo-minimo')).toHaveText('1')
    await expect(page.getByTestId('kpi-valor')).toHaveText('R$ 9.980,00')
    await expect(page.getByTestId('kpi-entradas')).toHaveText('4')
    await expect(page.getByTestId('kpi-saidas')).toHaveText('2')
    await expect(page.getByTestId('kpi-aprovacoes-pendentes')).toHaveText('1')
  })

  test('materiais para repor lista os que estão abaixo do mínimo, mais críticos primeiro', async ({ page }) => {
    await page.goto('/almoxarifado')
    const lista = page.getByTestId('para-repor')
    const linhas = lista.locator('li')
    // Arame (ZERADO) vem antes de Areia (ABAIXO) — sem estoque é mais crítico.
    await expect(linhas.nth(0)).toContainText('Arame')
    await expect(linhas.nth(1)).toContainText('Areia')
  })
})
