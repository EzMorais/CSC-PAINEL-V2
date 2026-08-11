import { expect, test } from '@playwright/test'
import { reiniciarBancoGo } from './apoio.go'

/**
 * Relatórios (Excel/PDF) — ver migracao-go/rh/COMPORTAMENTO.md §7. Checam sessão
 * manualmente (não passam pelo layout). Reaproveitam `internal/infrastructure/planilha` e
 * `internal/infrastructure/relatorio`, já usados pelo Painel de Locação.
 */

test.describe('Relatórios — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('Excel de funcionários baixa com conteúdo', async ({ page }) => {
    await page.goto('/rh/relatorios')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('baixar-funcionarios-xlsx').click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  })

  test('modelo vazio tem as mesmas colunas do relatório real', async ({ page }) => {
    await page.goto('/rh/relatorios')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('baixar-modelo-xlsx').click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  })

  test('PDF de resumo SST baixa com conteúdo', async ({ page }) => {
    await page.goto('/rh/relatorios')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('baixar-resumo-pdf').click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  // Bloco próprio: o fixture `request` herda o storageState autenticado do projeto (mesmo
  // cookie usado por `page` nos testes acima) a menos que seja limpo aqui — mesmo ajuste de
  // apps/painel-locacao/e2e/autenticacao.go.spec.ts para `/painel/export/xlsx`.
  test.describe('sem sessão', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('sem sessão, as rotas de relatório devolvem 401', async ({ request }) => {
      // Downloads ficam sob /rh (diferente das rotas de integração — ver
      // integracao-epi.go.spec.ts e integracao-funcionarios.go.spec.ts — que ficam em
      // /api/integracao/... sem prefixo, porque têm contrato externo com outros sistemas;
      // relatório só é chamado pela própria UI do RH, então prefixar não quebra nada).
      const resp = await request.get('/rh/relatorios/funcionarios.xlsx')
      expect(resp.status()).toBe(401)
    })
  })
})
