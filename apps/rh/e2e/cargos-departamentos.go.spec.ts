import { expect, test } from '@playwright/test'
import { ESPERADO, reiniciarBancoGo } from './apoio.go'

/**
 * Cargo (profissão) e Departamento (organograma de 2 níveis) — ver
 * migracao-go/rh/COMPORTAMENTO.md §2. `/configuracoes` usa `exigirLancamento`, não
 * `exigirAdministracao`, apesar do nome — ver §1.
 */

test.describe('Cargos e departamentos — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('lista os 10 cargos do seed', async ({ page }) => {
    await page.goto('/rh/configuracoes')
    await expect(page.getByTestId('lista-cargos').locator('tr, li')).toHaveCount(ESPERADO.cargos)
  })

  test('cria um cargo novo com risco PERICULOSO', async ({ page }) => {
    await page.goto('/rh/configuracoes')
    await page.getByTestId('novo-cargo-nome').fill('Operador de guindaste')
    await page.getByTestId('novo-cargo-risco').selectOption('PERICULOSO')
    await page.getByTestId('criar-cargo').click()
    await expect(page.getByText('Operador de guindaste')).toBeVisible()
  })

  test('nome de cargo duplicado é recusado', async ({ page }) => {
    await page.goto('/rh/configuracoes')
    await page.getByTestId('novo-cargo-nome').fill('Pedreiro')
    await page.getByTestId('novo-cargo-risco').selectOption('NORMAL')
    await page.getByTestId('criar-cargo').click()
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('setor novo precisa de um ramo já existente', async ({ page }) => {
    await page.goto('/rh/configuracoes')
    await page.getByTestId('novo-setor-nome').fill('Segurança do Trabalho')
    await page.getByTestId('novo-setor-ramo').selectOption({ label: 'Administrativo' })
    await page.getByTestId('criar-setor').click()
    await expect(page.getByText('Segurança do Trabalho')).toBeVisible()
  })
})
