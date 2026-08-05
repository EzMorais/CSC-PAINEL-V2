import { expect, test } from '@playwright/test'
import { reiniciarBancoGo } from './apoio.go'

/**
 * Solicitação de compra — contra o Almoxarifado em Go. Ver
 * migracao-go/estoque/COMPORTAMENTO.md §3 e §7.
 *
 * O que este arquivo protege: a sugestão automática lista só o que está abaixo do mínimo, com
 * a quantidade sugerida indo até o DOBRO do mínimo (não o mínimo exato); a pessoa pode
 * desmarcar itens e ajustar a quantidade antes de confirmar; "marcar como atendida" NÃO
 * mexe em saldo (quem cria estoque é a movimentação de ENTRADA, lançada à parte); e só
 * rascunho pode ser excluído — depois de decidido o status, o botão de excluir some.
 */

let SOLICITACAO_URL = ''

test.describe('Solicitações de compra — Go', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('sugestão automática lista os itens abaixo do mínimo com a quantidade certa', async ({ page }) => {
    await page.goto('/almoxarifado/solicitacoes/nova')

    // Arame: saldo 0, mínimo 10 -> alvo 20 (dobro do mínimo), sugestão 20.
    const linhaArame = page.locator('tr', { hasText: 'Arame recozido 18' })
    await expect(linhaArame.locator('input[type="number"]')).toHaveValue('20')

    // Areia: saldo 15, mínimo 20 -> alvo 40, sugestão 25 (40 - 15).
    const linhaAreia = page.locator('tr', { hasText: 'Areia média' })
    await expect(linhaAreia.locator('input[type="number"]')).toHaveValue('25')
  })

  test('cria solicitação só com o item selecionado e a quantidade ajustada', async ({ page }) => {
    await page.goto('/almoxarifado/solicitacoes/nova')

    await page.locator('tr', { hasText: 'Arame recozido 18' }).locator('input[type="checkbox"]').uncheck()
    const linhaAreia = page.locator('tr', { hasText: 'Areia média' })
    await linhaAreia.locator('input[type="number"]').fill('30')
    await page.getByLabel('Observação').fill('reposição — teste e2e')

    await page.getByTestId('confirmar-solicitacao').click()
    await page.waitForURL('**/almoxarifado/solicitacoes')

    // SC-2026-0001 já existe no seed (ver cmd/seed semearEstoque) — esta é a segunda do ano.
    const linha = page.getByTestId('solicitacao-SC-2026-0002')
    await expect(linha).toBeVisible()
    await expect(linha).toContainText('1 itens')
    await expect(linha).toContainText('Rascunho')

    await linha.click()
    SOLICITACAO_URL = page.url()
    await expect(page.getByTestId('itens-solicitacao')).toContainText('Areia média')
    await expect(page.getByTestId('itens-solicitacao')).toContainText('30 M3')
    await expect(page.getByTestId('itens-solicitacao')).not.toContainText('Arame')
  })

  test('marcar como atendida muda o status e não mexe no saldo', async ({ page }) => {
    await page.goto('/almoxarifado/materiais')
    await page.getByRole('link', { name: /Areia média/ }).click()
    const saldoAntes = await page.getByTestId('saldo-material').textContent()

    await page.goto(SOLICITACAO_URL)
    await page.getByTestId('marcar-atendida').click()
    await page.waitForURL(SOLICITACAO_URL)
    await expect(page.locator('.selo')).toContainText('Atendida')

    await page.goto('/almoxarifado/materiais')
    await page.getByRole('link', { name: /Areia média/ }).click()
    await expect(page.getByTestId('saldo-material')).toHaveText(saldoAntes ?? '')
  })

  test('depois de decidida, a solicitação não pode mais ser excluída', async ({ page }) => {
    await page.goto(SOLICITACAO_URL)
    await expect(page.getByTestId('excluir-solicitacao')).toHaveCount(0)
  })
})
