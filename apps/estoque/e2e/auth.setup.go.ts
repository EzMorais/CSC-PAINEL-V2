import { expect, test as setup } from '@playwright/test'
import { ARQUIVO_SESSAO_GO, USUARIO_TESTE } from './apoio.go'

setup('autentica e guarda a sessão', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
  await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 60_000 }),
    page.getByRole('button', { name: 'Entrar' }).click(),
  ])
  await expect(page.getByText('Olá, Administrador')).toBeVisible({ timeout: 60_000 })
  await page.context().storageState({ path: ARQUIVO_SESSAO_GO })
})
