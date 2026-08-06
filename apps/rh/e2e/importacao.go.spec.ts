import path from 'node:path'
import { expect, test } from '@playwright/test'
import { reiniciarBancoGo } from './apoio.go'

/**
 * Importação de planilha — ver migracao-go/rh/COMPORTAMENTO.md §5. Duas etapas (prévia sem
 * gravar / gravar relendo do zero), existente por CPF sempre pulado, cargo/obra citados e
 * inexistentes são criados antes do laço de pessoas.
 *
 * `fixtures/importacao-funcionarios.xlsx` tem 3 linhas: uma pessoa nova com obra/cargo
 * novos (testa criação automática), uma pessoa com o mesmo CPF de JOÃO BATISTA SILVEIRA do
 * seed (testa "sempre pulado"), e uma linha sem data de admissão (testa "entra com hoje").
 */

const PLANILHA = path.join(__dirname, 'fixtures', 'importacao-funcionarios.xlsx')

test.describe('Importação de funcionários — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('prévia mostra o que vai acontecer sem gravar nada', async ({ page }) => {
    await page.goto('/rh/funcionarios/importar')
    await page.getByTestId('importar-planilha').setInputFiles(PLANILHA)
    await page.getByRole('button', { name: 'Analisar' }).click()

    await expect(page.getByTestId('previa-novos')).toHaveText('2')
    await expect(page.getByTestId('previa-pulados')).toHaveText('1')

    // Nada foi gravado ainda.
    await page.goto('/rh/funcionarios')
    await expect(page.getByText('NOVO FUNCIONARIO TESTE')).not.toBeVisible()
  })

  test('confirmar grava, cria obra/cargo novos e pula quem já existe por CPF', async ({ page }) => {
    await page.goto('/rh/funcionarios/importar')
    await page.getByTestId('importar-planilha').setInputFiles(PLANILHA)
    await page.getByRole('button', { name: 'Analisar' }).click()
    await page.getByRole('button', { name: 'Confirmar importação' }).click()

    await expect(page.getByTestId('importacao-concluida')).toContainText('2')

    await page.goto('/rh/funcionarios')
    await expect(page.getByText('NOVO FUNCIONARIO TESTE')).toBeVisible()

    await page.goto('/rh/obras')
    await expect(page.getByText('EX-9999-26')).toBeVisible()
  })
})
