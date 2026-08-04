import { expect, test, type Page } from '@playwright/test'
import { PLANILHA, reiniciarBancoGo } from './apoio.go'

/**
 * Prova que o parser Go não regrediu — ver migracao-go/painel/COMPORTAMENTO.md §6.8: os
 * números abaixo foram conferidos célula a célula na planilha real da construtora e batem
 * exatamente com os documentados em `apps/painel-locacao/e2e/apoio.ts` `ESPERADO`
 * (305/242/63/16/90/20), confirmados rodando o parser Go contra o mesmo arquivo.
 *
 * `aConfirmar` não é conferido aqui: esse número depende de QUAIS obras compartilham aba no
 * `dados-locais.json` real da empresa (arquivo privado, fora deste repo — nem o Next.js
 * consegue reproduzi-lo sem ele). Este teste cria seu próprio mapeamento 1:1 (cada aba vira
 * uma obra exclusiva), então `aConfirmar` fica 0 de propósito — o resto dos números não
 * depende dessa configuração e por isso continua batendo.
 */

const ABAS = [
  'LINC', 'SC-1060-25_CLARIOS', 'SC-1096-25_CLARIOS', 'SC-1135-25B_MORELLI',
  'SC-1135-25A', 'SC-1017-26_TOYOTA', 'SC-1009-26_ADIMAX', 'SC-1176-25_ADIMAX',
]

const ESPERADO = {
  total: 305, ativos: 242, devolvidos: 63, perdidos: 16,
  duplicatas: 90 + 20, // ativos + devolvidas, somadas num cartão só na prévia
}

async function cadastrarObrasDasAbas(page: Page) {
  for (const aba of ABAS) {
    await page.goto('/painel/obras')
    await page.getByTestId('nova-obra').click()
    await page.locator('#cliente').fill('Cliente ' + aba)
    await page.locator('#codigo').fill(aba)
    await page.locator('#obraDescricao').fill('Obra de teste — ' + aba)
    await page.getByTestId('salvar-obra').click()
    await expect(page.getByText('Cliente ' + aba)).toBeVisible({ timeout: 15_000 })
  }
}

async function analisar(page: Page) {
  await page.goto('/painel/importar')
  await page.locator('#planilha').setInputFiles(PLANILHA)
  await page.getByRole('button', { name: 'Analisar' }).click()
  await expect(page.getByText('Prévia — nada foi gravado ainda')).toBeVisible({ timeout: 60_000 })
}

function cartao(page: Page, campo: string) {
  return page.getByTestId(`previa-${campo}`).locator('dd')
}

test.describe('Importação da planilha — Go', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('cadastra as obras e a prévia mostra os totais corretos', async ({ page }) => {
    await cadastrarObrasDasAbas(page)
    await analisar(page)

    await expect(cartao(page, 'ativos')).toHaveText(String(ESPERADO.ativos))
    await expect(cartao(page, 'devolvidos')).toHaveText(String(ESPERADO.devolvidos))
    await expect(cartao(page, 'perdidos')).toHaveText(String(ESPERADO.perdidos))
    await expect(cartao(page, 'possiveisDuplicatas')).toHaveText(String(ESPERADO.duplicatas))

    await expect(
      page.getByRole('button', { name: `Confirmar importação de ${ESPERADO.total} registros` }),
    ).toBeVisible()

    // Nada foi gravado ainda — a lista de locações continua vazia.
    await page.goto('/painel/locacoes?status=TODAS')
    await expect(page.getByTestId('contagem')).toHaveText('0 itens')
  })

  test('confirmar grava os registros', async ({ page }) => {
    await analisar(page)
    await page.getByRole('button', { name: /Confirmar importação/ }).click()
    await expect(page.getByTestId('importacao-concluida')).toBeVisible({ timeout: 240_000 })
    await expect(page.getByTestId('importacao-concluida')).toContainText(
      `${ESPERADO.total} locações criadas, 0 já existiam`,
    )

    await page.goto('/painel/locacoes?status=TODAS')
    await expect(page.getByTestId('contagem')).toHaveText(`${ESPERADO.total} itens`)
  })

  test('reimportar não duplica', async ({ page }) => {
    await analisar(page)
    await page.getByRole('button', { name: /Confirmar importação/ }).click()
    await expect(page.getByTestId('importacao-concluida')).toBeVisible({ timeout: 240_000 })
    await expect(page.getByTestId('importacao-concluida')).toContainText(
      `0 locações criadas, ${ESPERADO.total} já existiam`,
    )

    await page.goto('/painel/locacoes?status=TODAS')
    await expect(page.getByTestId('contagem')).toHaveText(`${ESPERADO.total} itens`)
  })
})
