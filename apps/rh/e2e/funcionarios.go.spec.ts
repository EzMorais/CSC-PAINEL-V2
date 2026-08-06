import { expect, test } from '@playwright/test'
import { ESPERADO, reiniciarBancoGo } from './apoio.go'

/**
 * CRUD de funcionário, busca/filtro e timeline automática — ver
 * migracao-go/rh/COMPORTAMENTO.md §2 (modelo), §3 (timeline automática).
 */

test.describe('Funcionários — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('lista mostra os 14 funcionários do seed', async ({ page }) => {
    await page.goto('/rh/funcionarios')
    await expect(page.getByTestId('lista-funcionarios').locator('tr, li[data-testid="nome-funcionario"]')).toHaveCount(
      ESPERADO.funcionarios,
    )
  })

  test('busca por nome filtra a lista', async ({ page }) => {
    await page.goto('/rh/funcionarios')
    await page.getByPlaceholder('Buscar').fill('JOÃO BATISTA')
    await page.keyboard.press('Enter')
    await expect(page.getByText('JOÃO BATISTA SILVEIRA')).toBeVisible()
    await expect(page.getByText('ANTÔNIO PEREIRA LIMA')).not.toBeVisible()
  })

  test('cadastra um funcionário novo e a matrícula sai sequencial', async ({ page }) => {
    await page.goto('/rh/funcionarios/novo')
    await page.getByLabel('Nome completo').fill('TESTE DA SILVA')
    // CPF sintaticamente válido (dígitos verificadores corretos), não usado no seed.
    await page.getByLabel('CPF').fill('123.456.789-09')
    await page.getByLabel('Data de admissão').fill('2026-01-10')
    await page.getByTestId('salvar').click()

    await expect(page).toHaveURL(/\/rh\/funcionarios\/[a-zA-Z0-9-]+$/)
    // O seed cria matrículas SC-0001 a SC-0014 — a próxima é SC-0015.
    await expect(page.getByTestId('matricula-funcionario')).toHaveText('SC-0015')
  })

  test('CPF inválido é recusado com mensagem específica', async ({ page }) => {
    await page.goto('/rh/funcionarios/novo')
    await page.getByLabel('Nome completo').fill('CPF INVALIDO TESTE')
    await page.getByLabel('CPF').fill('111.111.111-11')
    await page.getByLabel('Data de admissão').fill('2026-01-10')
    await page.getByTestId('salvar').click()
    await expect(page.getByRole('alert')).toContainText('CPF inválido')
  })

  test('editar a obra gera um evento de MUDANCA_OBRA na timeline, editar só o telefone não gera nada', async ({
    page,
  }) => {
    await page.goto('/rh/funcionarios')
    await page.getByText('ADRIANO CÉSAR BARBOSA').click()
    await expect(page).toHaveURL(/\/rh\/funcionarios\/[a-zA-Z0-9-]+$/)

    const eventosAntes = await page.getByTestId('linha-timeline').count()

    await page.getByTestId('editar').click()
    await page.getByLabel('Telefone').fill('(11) 99999-0000')
    await page.getByTestId('salvar').click()
    // Só telefone mudou — nenhum evento novo.
    await expect(page.getByTestId('linha-timeline')).toHaveCount(eventosAntes)

    await page.getByTestId('editar').click()
    await page.getByLabel('Obra').selectOption({ label: 'EX-1002-25' })
    await page.getByTestId('salvar').click()
    await expect(page.getByTestId('linha-timeline')).toHaveCount(eventosAntes + 1)
    await expect(page.getByTestId('linha-timeline').first()).toContainText('Obra:')
  })

  test('mudar o status para AFASTADO gera evento AFASTAMENTO', async ({ page }) => {
    await page.goto('/rh/funcionarios')
    await page.getByText('WELLINGTON SANTOS CRUZ').click()
    await page.getByTestId('editar').click()
    await page.getByLabel('Situação').selectOption('AFASTADO')
    await page.getByTestId('salvar').click()
    await expect(page.getByTestId('linha-timeline').first()).toContainText('Situação:')
  })
})
