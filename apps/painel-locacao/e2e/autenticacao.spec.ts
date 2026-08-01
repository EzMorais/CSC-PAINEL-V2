import { expect, test } from '@playwright/test'
import { USUARIO_TESTE } from './apoio'

/**
 * O que esta suíte protege: que o painel não entregue nada sem sessão.
 *
 * Ela é a única que roda deslogada — os outros projetos partem do cookie gravado pelo
 * `setup`, e é justamente por isso que o estado é zerado aqui. Sem esta anulação, o
 * teste "sem sessão vai para /entrar" passaria por engano, já que a sessão existiria.
 */
test.use({ storageState: { cookies: [], origins: [] } })

const PAGINAS_PROTEGIDAS = ['/', '/locacoes', '/locacoes/nova', '/obras', '/fornecedores', '/importar']

test.describe('Autenticação', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const caminho of PAGINAS_PROTEGIDAS) {
    test(`${caminho} sem sessão vai para a tela de login`, async ({ page }) => {
      await page.goto(caminho, { timeout: 120_000 })
      await expect(page).toHaveURL(/\/entrar$/)
      // A navegação não pode aparecer nem por um instante: ela lista as obras.
      await expect(page.getByTestId('navegacao')).toHaveCount(0)
    })
  }

  /**
   * Layout não roda em rota de API — esta é a única coisa que impede alguém de baixar a
   * planilha inteira (custo por obra, valor por fornecedor) digitando o endereço.
   */
  for (const rota of ['/api/export/xlsx', '/api/export/pdf']) {
    test(`${rota} sem sessão responde 401`, async ({ request }) => {
      const r = await request.get(rota)
      expect(r.status()).toBe(401)
    })
  }

  test('senha errada não entra e não diz qual campo falhou', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    const erro = page.getByTestId('erro-login')
    await expect(erro).toBeVisible()
    // Mensagem única de propósito: distinguir os dois casos revela quem tem conta.
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

    await expect(page.getByTestId('navegacao')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(USUARIO_TESTE.email)).toBeVisible()

    await page.getByTestId('sair').click()
    await expect(page).toHaveURL(/\/entrar$/)

    // Voltar para uma página protegida depois de sair não pode reaproveitar o cookie.
    await page.goto('/locacoes', { timeout: 120_000 })
    await expect(page).toHaveURL(/\/entrar$/)
  })
})
