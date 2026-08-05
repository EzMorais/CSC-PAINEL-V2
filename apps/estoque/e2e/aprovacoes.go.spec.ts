import { expect, test, type Page } from '@playwright/test'
import { reiniciarBancoGo, USUARIO_ALMOXARIFE, USUARIO_GERENTE } from './apoio.go'

/**
 * Fluxo de aprovação (propose-then-execute) — contra o Almoxarifado em Go. Ver
 * migracao-go/estoque/COMPORTAMENTO.md §4.
 *
 * O que este arquivo protege: uma PERDA lançada por quem não aprova (cargo OPERACIONAL) NÃO
 * muda o saldo na hora — fica pendente até alguém com cargo de aprovação (GERENTE/DIRETORIA/
 * ADMIN) decidir. O saldo só muda depois da aprovação, e é esse segundo usuário — não o que
 * pediu — quem precisa decidir.
 *
 * Login trocado no meio do arquivo de propósito: o cenário inteiro depende de DUAS pessoas
 * com cargos diferentes, então cada teste entra explicitamente com a conta que precisa, sem
 * depender do storageState de admin gravado pelo `setup`.
 */

const MATERIAL_CIMENTO = 'Cimento CP-II 50kg'

async function loginComo(page: Page, credenciais: { email: string; senha: string }) {
  // /entrar redireciona pra "/" se já existe sessão (ver handlers/identidade/entrar.go) — como
  // este arquivo troca de usuário no meio da suíte, é preciso derrubar a sessão anterior
  // antes, senão a navegação pra /entrar nunca chega no formulário.
  await page.context().clearCookies()
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(credenciais.email)
  await page.getByLabel('Senha').fill(credenciais.senha)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 60_000 }),
    page.getByRole('button', { name: 'Entrar' }).click(),
  ])
}

async function saldoDoCimento(page: Page): Promise<string> {
  await page.goto('/almoxarifado/materiais')
  await page.getByRole('link', { name: new RegExp(MATERIAL_CIMENTO) }).click()
  return (await page.getByTestId('saldo-material').textContent()) ?? ''
}

test.describe('Aprovações — Go', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('almoxarife (OPERACIONAL) lança perda e ela fica pendente — saldo não muda', async ({ page }) => {
    await loginComo(page, USUARIO_ALMOXARIFE)

    const saldoAntes = await saldoDoCimento(page)
    expect(saldoAntes).toBe('200 SC')

    await page.getByTestId('abrir-movimentar').click()
    await page.locator('#tipo').selectOption('PERDA')
    await page.locator('#quantidade').fill('5')
    await page.getByTestId('confirmar-movimentar').click()

    await expect(page.locator('.aviso')).toContainText('Enviado para aprovação')
    await expect(page.getByTestId('saldo-material')).toHaveText('200 SC')
  })

  test('gerente vê o pedido pendente e aprova — só então o saldo muda', async ({ page }) => {
    await loginComo(page, USUARIO_GERENTE)

    await page.goto('/almoxarifado/aprovacoes')
    const cartao = page.locator('[data-testid^="aprovacao-"]').filter({ hasText: 'Cimento CP-II 50kg' })
    await expect(cartao).toContainText('baixa de 5 SC por perda ou quebra')
    await expect(cartao).toContainText('Ana Almoxarife')

    await cartao.getByTestId(/^aprovar-/).click()
    await page.waitForURL('**/almoxarifado/aprovacoes')

    const saldoDepois = await saldoDoCimento(page)
    expect(saldoDepois).toBe('195 SC')
    await expect(page.getByTestId('historico-material')).toContainText('Perda ou quebra')
  })

  test('aprovação já decidida some da fila de pendentes', async ({ page }) => {
    await loginComo(page, USUARIO_GERENTE)
    await page.goto('/almoxarifado/aprovacoes')
    await expect(page.locator('[data-testid^="aprovacao-"]').filter({ hasText: 'Cimento CP-II 50kg' })).toHaveCount(0)

    await page.goto('/almoxarifado/aprovacoes?status=APROVADA')
    await expect(page.locator('[data-testid^="aprovacao-"]').filter({ hasText: 'Cimento CP-II 50kg' })).toHaveCount(1)
  })
})
