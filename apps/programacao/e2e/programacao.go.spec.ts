import { expect, test } from '@playwright/test'
import { BASE_GATEWAY } from './apoio.go'

/**
 * A URL pública de Programação é atendida pelo gateway, mas a tela é o app Next.js legado.
 * Estes checks cobrem a troca solicitada sem depender da implementação Go despublicada.
 */
test.describe('Programação Diária — legado pelo gateway', () => {
  test('sem sessão preserva o destino ao encaminhar para o login', async ({ context, page }) => {
    await context.clearCookies()

    await page.goto(`${BASE_GATEWAY}/programacao`)
    await expect(page).toHaveURL(/\/entrar\?destino=%2Fprogramacao$/)
  })

  test('a entrada pública abre a programação solicitada e carrega os assets prefixados', async ({ page }) => {
    await page.goto('/programacao')

    await expect(page).toHaveURL(/\/programacao\/dia\/2026-08-13$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('13')
    await expect(page.getByLabel('Voltar ao painel principal')).toHaveAttribute('href', BASE_GATEWAY)
    await expect(page.getByTestId('hub-navegacao-botao')).toHaveCount(0)

    const logo = await page.request.get('/programacao/marca-icone.png')
    expect(logo.status()).toBe(200)

    await page.goto('/programacao/frentes')
    await expect(page.getByTestId('lista-frentes')).toContainText('TOYOTA')
  })
})
