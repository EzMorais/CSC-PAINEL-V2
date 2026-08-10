import { expect, test } from '@playwright/test'
import { reiniciarBancoGo } from './apoio.go'

/**
 * Exclusão de funcionário — ver migracao-go/rh/COMPORTAMENTO.md §4. Só ADMIN, bloqueada por
 * vínculo de prova legal (EPI/uniforme/exame/treinamento/documento), livre por Evento/
 * Dependente (que são apagados junto).
 */

test.describe('Exclusão de funcionário — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('bloqueada quando há vínculo de prova legal, com mensagem listando quantos de cada', async ({ page }) => {
    await page.goto('/rh/funcionarios')
    // PAULO HENRIQUE COSTA tem exame/treinamento/uniforme semeados (ver semearRH).
    await page.getByText('PAULO HENRIQUE COSTA').click()
    await page.getByTestId('excluir-funcionario').click()
    await page.getByTestId('confirmar-exclusao').click()

    await expect(page.getByRole('alert')).toContainText('prova de que a empresa entregou EPI')
    await expect(page.getByRole('alert')).toContainText('Registre o desligamento')
  })

  test('cadastro sem nenhum vínculo pode ser excluído, e Evento/Dependente somem junto', async ({ page }) => {
    await page.goto('/rh/funcionarios')
    // WELLINGTON SANTOS CRUZ não tem EPI/uniforme/exame/treinamento/documento no seed.
    await page.getByText('WELLINGTON SANTOS CRUZ').click()
    await page.getByTestId('excluir-funcionario').click()
    await page.getByTestId('confirmar-exclusao').click()

    await expect(page).toHaveURL('/rh/funcionarios')
    await expect(page.getByText('WELLINGTON SANTOS CRUZ')).not.toBeVisible()
  })
})
