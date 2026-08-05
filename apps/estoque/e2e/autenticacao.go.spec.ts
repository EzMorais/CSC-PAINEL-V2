import { expect, test } from '@playwright/test'
import { USUARIO_TESTE } from './apoio.go'

/**
 * Linha de base de comportamento — ver migracao-go/estoque/COMPORTAMENTO.md §1. Roda
 * deslogada por padrão: as demais specs partem do cookie gravado pelo `setup`.
 */
test.use({ storageState: { cookies: [], origins: [] } })

const PAGINAS_PROTEGIDAS = [
  '/almoxarifado', '/almoxarifado/materiais', '/almoxarifado/movimentacoes',
  '/almoxarifado/solicitacoes', '/almoxarifado/solicitacoes/nova', '/almoxarifado/aprovacoes',
  '/almoxarifado/configuracoes',
]

test.describe('Autenticação — Almoxarifado', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const caminho of PAGINAS_PROTEGIDAS) {
    test(`${caminho} sem sessão vai para /entrar`, async ({ page }) => {
      await page.goto(caminho, { timeout: 120_000 })
      await expect(page).toHaveURL(/\/entrar$/)
      await expect(page.getByTestId('navegacao')).toHaveCount(0)
    })
  }

  test('credenciais corretas entram, e sair volta pro login', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
    await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('Olá, Administrador')).toBeVisible({ timeout: 60_000 })

    await page.goto('/almoxarifado')
    await expect(page.getByTestId('navegacao')).toBeVisible()

    await page.getByTestId('sair').click()
    await expect(page).toHaveURL(/\/entrar$/)

    await page.goto('/almoxarifado/materiais', { timeout: 120_000 })
    await expect(page).toHaveURL(/\/entrar$/)
  })
})
