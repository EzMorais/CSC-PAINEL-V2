import { expect, test } from '@playwright/test'
import { USUARIO_TESTE } from './apoio'

/**
 * Linha de base de comportamento pra migração — ver migracao-go/portal/COMPORTAMENTO.md §2.
 *
 * Roda deslogada por padrão: os outros arquivos partem do cookie gravado pelo `setup`, e é
 * justamente por isso que o estado é zerado aqui.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Autenticação', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const caminho of ['/', '/usuarios']) {
    test(`${caminho} sem sessão vai para /entrar`, async ({ page }) => {
      await page.goto(caminho, { timeout: 120_000 })
      await expect(page).toHaveURL(/\/entrar$/)
    })
  }

  test('senha errada não entra e não diz qual campo falhou', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    const erro = page.getByTestId('erro-login')
    await expect(erro).toBeVisible()
    // Mensagem única de propósito — ver COMPORTAMENTO.md §2.1: distinguir os casos
    // revelaria quais e-mails têm conta.
    await expect(erro).toHaveText('E-mail ou senha não conferem.')
    await expect(page).toHaveURL(/\/entrar$/)
  })

  test('e-mail inexistente dá a mesma mensagem que senha errada', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill('ninguem@siqueiracampos.com.br')
    await page.getByLabel('Senha').fill('qualquer-coisa')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByTestId('erro-login')).toHaveText('E-mail ou senha não conferem.')
  })

  test('credenciais corretas entram, e sair volta para o login', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
    await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('Olá, Administrador')).toBeVisible({ timeout: 60_000 })

    await page.getByTestId('sair').click()
    await expect(page).toHaveURL(/\/entrar$/)

    // Voltar pra uma página protegida depois de sair não pode reaproveitar o cookie antigo.
    await page.goto('/usuarios', { timeout: 120_000 })
    await expect(page).toHaveURL(/\/entrar$/)
  })

  test('quem já está logado, ao abrir /entrar, é mandado pra /', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
    await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/$/, { timeout: 60_000 })

    await page.goto('/entrar')
    await expect(page).toHaveURL(/\/$/)
    await ctx.close()
  })

  test.describe('destino pós-login (proteção contra open redirect)', () => {
    test('caminho relativo é respeitado', async ({ browser }) => {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await page.goto('/entrar?destino=%2Fusuarios')
      await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
      await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL(/\/usuarios$/, { timeout: 60_000 })
      await ctx.close()
    })

    test('endereço absoluto é ignorado, cai em /', async ({ browser }) => {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await page.goto('/entrar?destino=https%3A%2F%2Fsite-qualquer.com')
      await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
      await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/, { timeout: 60_000 })
      await ctx.close()
    })

    test('"//" é ignorado (protocolo-relativo), cai em /', async ({ browser }) => {
      const ctx = await browser.newContext()
      const page = await ctx.newPage()
      await page.goto('/entrar?destino=%2F%2Fsite-qualquer.com')
      await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
      await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/, { timeout: 60_000 })
      await ctx.close()
    })
  })
})
