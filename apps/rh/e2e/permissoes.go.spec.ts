import { expect, test } from '@playwright/test'
import { FIXTURE, USUARIO_CONSULTA, USUARIO_OPERACIONAL, reiniciarBancoGo } from './apoio.go'

/**
 * As 4 guardas de sessão — ver migracao-go/rh/COMPORTAMENTO.md §1. `exigirAprovacao` não é
 * exercitada aqui de propósito: não é usada em nenhuma action do RH (não existe fluxo de
 * aprovação neste módulo — ver §1).
 */
test.use({ storageState: { cookies: [], origins: [] } })

async function login(page: import('@playwright/test').Page, usuario: { email: string; senha: string }) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(usuario.email)
  await page.getByLabel('Senha').fill(usuario.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByTestId('navegacao')).toBeVisible({ timeout: 60_000 })
}

test.describe('Permissões — RH — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('CONSULTA lê a lista de funcionários mas não vê botão de cadastrar', async ({ page }) => {
    await login(page, USUARIO_CONSULTA)
    await page.goto('/rh/funcionarios')
    await expect(page.getByText('JOÃO BATISTA SILVEIRA')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Novo funcionário' })).toHaveCount(0)
  })

  test('CONSULTA não consegue submeter a criação de funcionário mesmo indo direto na URL', async ({ page }) => {
    await login(page, USUARIO_CONSULTA)
    await page.goto('/rh/funcionarios/novo')
    await page.getByLabel('Nome completo').fill('NAO DEVERIA SALVAR')
    await page.getByLabel('CPF').fill('123.456.789-09')
    await page.getByLabel('Data de admissão').fill('2026-01-10')
    await page.getByTestId('salvar').click()
    // exigirLancamento devolve texto puro com 403 (http.Error), mesmo padrão de
    // handlers/painel e handlers/estoque — não é uma página HTML com role="alert".
    await expect(page.getByText('Seu cargo permite apenas consultar')).toBeVisible()

    await page.goto('/rh/funcionarios')
    await expect(page.getByText('NAO DEVERIA SALVAR')).not.toBeVisible()
  })

  test('OPERACIONAL lança funcionário mas não vê botão de excluir', async ({ page }) => {
    await login(page, USUARIO_OPERACIONAL)
    await page.goto('/rh/funcionarios')
    await page.getByText(FIXTURE.funcionarioSemVinculos).click()
    await expect(page.getByTestId('excluir-funcionario')).toHaveCount(0)
  })

  test('OPERACIONAL não consegue excluir mesmo chamando a action direto', async ({ page }) => {
    await login(page, USUARIO_OPERACIONAL)
    await page.goto('/rh/funcionarios')
    await page.getByText(FIXTURE.funcionarioSemVinculos).click()
    const id = (await page.url()).split('/').pop()!

    // page.request (não o fixture `request` solto) — compartilha o cookie de sessão do
    // `page`, que acabou de logar como OPERACIONAL. `request` sozinho tem seu próprio
    // contexto sem cookie nenhum, e sem sessão o handler REDIRECIONA pra /entrar (302),
    // que o cliente HTTP segue e devolve 200 — dava um falso positivo aqui antes.
    const resp = await page.request.post(`/rh/funcionarios/${id}/excluir`)
    expect(resp.status()).toBe(403)

    await page.goto('/rh/funcionarios')
    await expect(page.getByText(FIXTURE.funcionarioSemVinculos)).toBeVisible()
  })

  test('só ADMIN vê e consegue usar o botão de excluir', async ({ page }) => {
    await login(page, { email: 'admin@siqueiracampos.com.br', senha: process.env.SENHA_ADMIN || 'locacao2026' })
    await page.goto('/rh/funcionarios')
    await page.getByText(FIXTURE.funcionarioSemVinculos).click()
    await expect(page.getByTestId('excluir-funcionario')).toBeVisible()
  })
})
