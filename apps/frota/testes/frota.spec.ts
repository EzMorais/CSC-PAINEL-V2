import { test, expect } from '@playwright/test';

const EMAIL = 'admin@siqueiracampos.com.br';
const SENHA = process.env.SENHA_ADMIN || 'frota2026';

async function entrar(page: import('@playwright/test').Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/veiculos/);
}

test('bloqueia quem não entrou', async ({ page }) => {
  await page.goto('/veiculos');
  await expect(page).toHaveURL(/\/entrar/);
});

test('recusa senha errada', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('não conferem');
});

test('entra e lista a frota', async ({ page }) => {
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Veículos' })).toBeVisible();
  await expect(page.getByText('RETROESCAVADEIRA CASE - 580NS2')).toBeVisible();
});

test('navega por todas as áreas', async ({ page }) => {
  await entrar(page);
  for (const [rotulo, url] of [
    ['Manutenções', /\/manutencoes/],
    ['Abastecimento', /\/abastecimento/],
    ['Alertas', /\/alertas/],
  ] as const) {
    await page.getByRole('link', { name: rotulo }).first().click();
    await expect(page).toHaveURL(url);
  }
});

test('troca o motorista e registra no histórico', async ({ page }) => {
  await entrar(page);
  const cartao = page.locator('li', { hasText: 'RETROESCAVADEIRA CASE - 580NS2' }).first();
  await cartao.getByRole('button', { name: /Ações de/ }).click();
  await page.getByRole('button', { name: 'Trocar motorista' }).click();
  await page.getByLabel('Novo motorista').fill('Teste Automatizado');
  await page.getByRole('button', { name: 'Trocar' }).click();
  await expect(page.getByText('Teste Automatizado')).toBeVisible();
});

test('baixa a planilha do chefe', async ({ page }) => {
  await entrar(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Planilha do chefe|Baixar planilha/ }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Controle_Veiculos_.*\.xlsx$/);
});

test('funciona no celular com a barra inferior', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'só no perfil de celular');
  await entrar(page);
  const barra = page.locator('nav').last();
  await expect(barra).toBeVisible();
  await barra.getByRole('link', { name: 'Abastecimento' }).click();
  await expect(page).toHaveURL(/\/abastecimento/);
});
