import { expect, test } from '@playwright/test'
import { BASE, reiniciarBancoGo } from './apoio.go'

/**
 * Alojamentos — contra o binário Go. Ver migracao-go/alojamentos/COMPORTAMENTO.md e o
 * template em migracao-go/templates/alojamentos/alojamentos.templ.
 *
 * O seed Go NÃO semeia Alojamentos (ver cmd/seed/main.go), então esta suíte é
 * auto-semeadora: cria alojamento, quarto, rota, alocação (morador do RH que o seed
 * `semearRH` já trouxe), pedido manual e programação — tudo pela interface — e então
 * confere o dashboard. Os seletores usam `name=...`/placeholders: o template não tem
 * `data-testid` e os `<label>` não têm `for`.
 *
 * Ordem serial: cada teste aproveita o que o anterior criou (mesmo banco, mesmo servidor).
 */

test.describe('Alojamentos — Go', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('dashboard começa vazio depois do reset', async ({ page }) => {
    await page.goto('/alojamentos')
    await expect(page.getByText('Alojamentos ativos').locator('../strong')).toHaveText('0')
    await expect(page.getByText('Moradores').locator('../strong')).toHaveText('0')
    await expect(page.getByText('Pedidos abertos').locator('../strong')).toHaveText('0')
    await expect(page.getByText('Nenhuma programação futura.')).toBeVisible()
    await expect(page.getByText('Nenhum pedido recente.')).toBeVisible()
  })

  test('cria alojamento pelo formulário', async ({ page }) => {
    await page.goto('/alojamentos/cadastros')
    await page.getByText('+ Novo alojamento').click()

    await page.locator('input[name="nome"]').fill(BASE.alojamentoNome)
    await page.locator('input[name="cep"]').fill('07012-000')
    await page.locator('input[name="cidade"]').fill('Guarulhos')
    await page.locator('input[name="uf"]').fill('SP')
    await page.locator('input[name="responsavel"]').fill('Sebastião Ramos')
    await page.locator('input[name="telefone"]').fill('(11) 98888-1122')
    await page.locator('input[name="capacidade"]').fill('10')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page).toHaveURL(/\/alojamentos\/cadastros\/[0-9a-f-]+/)
    await expect(page.locator('h1')).toHaveText(BASE.alojamentoNome)
  })

  test('cria quarto no detalhe do alojamento', async ({ page }) => {
    await page.goto('/alojamentos/cadastros')
    await page.getByRole('link', { name: BASE.alojamentoNome }).click()

    const formularioQuarto = page.locator('form[action$="/quartos"]')
    await formularioQuarto.locator('input[name="numero"]').fill(BASE.numeroQuarto)
    await formularioQuarto.locator('input[name="capacidade"]').fill('4')
    await formularioQuarto.locator('select[name="tipo"]').selectOption('MASCULINO')
    await formularioQuarto.getByRole('button', { name: 'Criar quarto' }).click()

    // O form é o mesmo da criação — volta pro detalhe; a linha do quarto mostra 0/4.
    await expect(page).toHaveURL(/\/alojamentos\/cadastros\/[0-9a-f-]+/)
    await expect(page.locator('table tbody')).toContainText('101')
    await expect(page.locator('table tbody')).toContainText('0/4')
  })

  test('cria rota de ônibus', async ({ page }) => {
    await page.goto('/alojamentos/rotas')
    await page.locator('input[placeholder="Nome"]').fill(BASE.rotaNome)
    await page.locator('input[placeholder="Motorista"]').fill('João Motorista')
    await page.locator('input[placeholder="Veículo"]').fill('Ônibus 42')
    await page.locator('input[placeholder="Ida"]').fill('06:30')
    await page.locator('input[placeholder="Volta"]').fill('18:00')
    await page.locator('input[placeholder="Capacidade"]').fill('40')
    await page.getByRole('button', { name: 'Criar' }).click()

    await expect(page).toHaveURL(/\/alojamentos\/rotas/)
    await expect(page.locator('table tbody')).toContainText(BASE.rotaNome)
  })

  test('aloca morador (funcionário do RH) em alojamento ativo', async ({ page }) => {
    await page.goto('/alojamentos/moradores')
    await page.getByText('+ Alocar morador').click()

    await page.locator('select[name="funcionarioId"]').selectOption({ label: BASE.moradorNome })
    await page.locator('select[name="alojamentoId"]').selectOption({ label: BASE.alojamentoNome })
    await page.locator('input[name="dataEntrada"]').fill('2026-08-11')
    await page.locator('select[name="transporte"]').selectOption('ONIBUS')
    await page.locator('select[name="rotaId"]').selectOption({ label: BASE.rotaNome })
    await page.locator('input[name="telefone"]').fill(BASE.moradorTelefone)
    await page.getByRole('button', { name: 'Alocar' }).click()

    await expect(page).toHaveURL(/\/alojamentos\/moradores/)
    const linha = page.locator('table tbody tr').filter({ hasText: BASE.moradorNome })
    await expect(linha).toBeVisible()
    await expect(linha).toContainText('SC-0001') // matrícula do RH semeado
    await expect(linha).toContainText(BASE.alojamentoNome)
    await expect(linha).toContainText('ONIBUS')
  })

  test('levanta pedido manual e ele entra como aberto', async ({ page }) => {
    await page.goto('/alojamentos/pedidos')
    await page.getByText('+ Novo pedido').click()

    await page.locator('select[name="alojamentoId"]').selectOption({ label: BASE.alojamentoNome })
    await page.locator('select[name="tipo"]').selectOption('LIMPEZA')
    await page.locator('input[name="titulo"]').fill('Repor papel higiênico e sabão')
    await page.locator('select[name="prioridade"]').selectOption('ALTA')
    await page.getByRole('button', { name: 'Registrar' }).click()

    await expect(page).toHaveURL(/\/alojamentos\/pedidos/)
    const linha = page.locator('table tbody tr').filter({ hasText: 'Repor papel higiênico e sabão' })
    await expect(linha).toContainText('ABERTO')
  })

  test('programa um evento para hoje', async ({ page }) => {
    await page.goto('/alojamentos/programacao')
    await page.locator('input[name="data"]').fill('2026-08-11')
    await page.locator('select[name="tipo"]').selectOption('LIMPEZA')
    await page.locator('input[name="titulo"]').fill('Limpeza geral dos quartos')
    await page.getByRole('button', { name: 'Adicionar' }).click()

    await expect(page).toHaveURL(/\/alojamentos\/programacao/)
    await expect(page.locator('ul')).toContainText('Limpeza geral dos quartos')
  })

  test('dashboard reflete o que a suíte criou', async ({ page }) => {
    await page.goto('/alojamentos')
    await expect(page.getByText('Alojamentos ativos').locator('../strong')).toHaveText('1')
    await expect(page.getByText('Moradores').locator('../strong')).toHaveText('1')
    await expect(page.getByText('Vagas').locator('../strong')).toHaveText('3') // 4 (quarto 101) − 1 morador
    await expect(page.getByText('Pedidos abertos').locator('../strong')).toHaveText('1')
    const painelProgramacao = page
      .locator('section.painel-dados')
      .filter({ has: page.getByRole('heading', { name: 'Próxima programação', exact: true }) })
    await expect(painelProgramacao.locator('.lista-dashboard')).toContainText('Limpeza geral dos quartos')
    await expect(page.getByText('Repor papel higiênico e sabão')).toBeVisible()
  })
})
