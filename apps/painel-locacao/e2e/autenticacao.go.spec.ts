import { expect, test } from '@playwright/test'
import { USUARIO_TESTE } from './apoio.go'

/**
 * Linha de base de comportamento — ver migracao-go/painel/COMPORTAMENTO.md §1. Roda
 * deslogada por padrão: as demais specs partem do cookie gravado pelo `setup`.
 */
test.use({ storageState: { cookies: [], origins: [] } })

const PAGINAS_PROTEGIDAS = [
  '/painel', '/painel/locacoes', '/painel/locacoes/nova', '/painel/obras',
  '/painel/fornecedores', '/painel/importar',
]

test.describe('Autenticação — Painel de Locação', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const caminho of PAGINAS_PROTEGIDAS) {
    test(`${caminho} sem sessão vai para /entrar`, async ({ page }) => {
      await page.goto(caminho, { timeout: 120_000 })
      await expect(page).toHaveURL(/\/entrar$/)
      await expect(page.getByTestId('navegacao')).toHaveCount(0)
    })
  }

  // Rotas de exportação respondem 401 direto — nunca deveriam entregar o arquivo (custo por
  // obra, valor por fornecedor) a quem não tem sessão. Ver COMPORTAMENTO.md §1 e §7.
  for (const rota of ['/painel/export/xlsx', '/painel/export/pdf']) {
    test(`${rota} sem sessão responde 401`, async ({ request }) => {
      const r = await request.get(rota)
      expect(r.status()).toBe(401)
    })
  }

  test('credenciais corretas entram, e sair volta pro login', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
    await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('Olá, Administrador')).toBeVisible({ timeout: 60_000 })

    await page.goto('/painel')
    await expect(page.getByTestId('navegacao')).toBeVisible()

    await page.getByTestId('sair').click()
    await expect(page).toHaveURL(/\/entrar$/)

    await page.goto('/painel/locacoes', { timeout: 120_000 })
    await expect(page).toHaveURL(/\/entrar$/)
  })
})
