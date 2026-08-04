import { expect, test as setup } from '@playwright/test'
import { ARQUIVO_SESSAO, USUARIO_TESTE } from './apoio'

/**
 * Loga como admin uma vez e guarda o cookie pro projeto `desktop`. Ver auth.setup.ts do
 * painel-locacao — mesmo padrão, mesma razão: evita autenticar em cada teste.
 */
setup('autentica e guarda a sessão', async ({ page }) => {
  await page.goto('/entrar')

  await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
  await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await page.waitForURL('**/', { timeout: 60_000 })
  await expect(page.getByText('Olá, Administrador')).toBeVisible({ timeout: 60_000 })

  await page.context().storageState({ path: ARQUIVO_SESSAO })
})
