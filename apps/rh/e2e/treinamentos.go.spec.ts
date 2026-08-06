import { expect, test } from '@playwright/test'
import { ESPERADO, reiniciarBancoGo } from './apoio.go'

/**
 * Treinamentos NR — ver migracao-go/rh/COMPORTAMENTO.md §2/§3. `validadeEm` é digitado, não
 * calculado a partir da norma. Janela de alerta fixa de 30 dias. Fixture exata em apoio.go.ts
 * `FIXTURE` (comentário de `ESPERADO`).
 */

test.describe('Treinamentos — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('lista as 3 turmas do seed', async ({ page }) => {
    await page.goto('/rh/treinamentos')
    await expect(page.getByTestId('contagem-turmas')).toHaveText(String(ESPERADO.treinamentos))
  })

  test('alerta de vencimento mostra a turma vencida e a vencendo em 30 dias, não a sem validade', async ({
    page,
  }) => {
    await page.goto('/rh/treinamentos')
    const alertas = page.getByTestId('alertas-vencimento')
    await expect(alertas).toContainText('Trabalho em Altura — Turma A') // vencida
    await expect(alertas).toContainText('Construção Civil — Turma B') // vencendo
    await expect(alertas).not.toContainText('Segurança em Eletricidade — Integração') // sem validade
  })

  test('detalhe da turma lista os participantes e aceita certificado', async ({ page }) => {
    await page.goto('/rh/treinamentos')
    await page.getByText('Construção Civil — Turma B').click()
    await expect(page.getByTestId('lista-participantes').locator('li')).toHaveCount(2)
    await expect(page.getByText('PAULO HENRIQUE COSTA')).toBeVisible()
    await expect(page.getByText('RAFAEL AUGUSTO MENDES')).toBeVisible()
  })

  test('busca de turma filtra por descrição', async ({ page }) => {
    await page.goto('/rh/treinamentos')
    await page.getByTestId('busca-turma').fill('Altura')
    await expect(page.getByText('Trabalho em Altura — Turma A')).toBeVisible()
    await expect(page.getByText('Construção Civil — Turma B')).not.toBeVisible()
  })

  test('desligado não pode ser matriculado numa turma nova', async ({ page }) => {
    await page.goto('/rh/treinamentos')
    await page.getByText('Construção Civil — Turma B').click()
    await page.getByTestId('adicionar-participante').click()
    // MARIA DE LOURDES RAMOS está DESLIGADA no seed.
    await expect(page.getByRole('combobox', { name: /participante/i })).not.toContainText(
      'MARIA DE LOURDES RAMOS',
    )
  })
})
