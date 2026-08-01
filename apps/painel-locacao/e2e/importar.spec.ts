import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import { ESPERADO, PLANILHA, reiniciarBanco } from './apoio'

/**
 * Este é o teste que prova que o parser não regrediu: qualquer mudança que faça o
 * sistema ler 241 ou 243 itens quebra aqui.
 *
 * O roteiro original da Task 21 conferia os totais gravados pelas telas `/locacoes`
 * (data-testid="contagem") e `/` (data-testid="kpis"). Nenhuma das duas existe nesta
 * base: `/locacoes` está na branch task14-listagem, ainda não integrada, e o dashboard
 * da Task 13 não foi escrito — `src/app/page.tsx` continua sendo o template do Next.
 * Em vez de esperar por elas, a conferência do que foi gravado é feita direto no
 * teste.db: é uma prova mais forte que o texto renderizado, porque distingue "gravou
 * 305 registros" de "a tela exibe 305". Quando as telas entrarem, vale acrescentar as
 * asserções de UI por cima destas — não no lugar delas.
 */

/** Locações no banco de teste, por dimensão. Espelha os campos que a prévia conta. */
async function contagens() {
  // Caminho absoluto: o cliente resolve `file:./teste.db` relativo ao schema, e este
  // arquivo roda de outro diretório. Absoluto vale de qualquer lugar.
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve('prisma/teste.db')}` } },
  })
  try {
    const [total, ativos, devolvidos, perdidos, aConfirmar, possiveisDuplicatas] = await Promise.all([
      prisma.locacao.count(),
      // "Ativa" aqui é a mesma definição da prévia: não devolvida. Não usa
      // calcularStatus de propósito — o resultado não pode depender da data de hoje.
      prisma.locacao.count({ where: { devolvidaEm: null } }),
      prisma.locacao.count({ where: { devolvidaEm: { not: null } } }),
      prisma.locacao.count({ where: { estado: 'PERDIDO' } }),
      prisma.locacao.count({ where: { obraAConfirmar: true } }),
      prisma.locacao.count({ where: { possivelDuplicata: true } }),
    ])
    return { total, ativos, devolvidos, perdidos, aConfirmar, possiveisDuplicatas }
  } finally {
    await prisma.$disconnect()
  }
}

/** Envia a planilha e espera a prévia aparecer. */
async function analisar(page: import('@playwright/test').Page) {
  await page.goto('/importar')
  await page.setInputFiles('#planilha', PLANILHA)
  await page.getByRole('button', { name: 'Analisar' }).click()
  await expect(page.getByText('Prévia — nada foi gravado ainda')).toBeVisible({ timeout: 60_000 })
}

/** Valor exibido em um cartão da prévia, sem o rótulo em volta. */
function cartao(page: import('@playwright/test').Page, campo: string) {
  return page.getByTestId(`previa-${campo}`).locator('dd')
}

test.describe('Importação da planilha', () => {
  // `serial` não é decoração: o terceiro teste só significa alguma coisa sobre o estado
  // que o segundo deixou no banco. Sem isto, ele passaria ou falharia conforme a ordem
  // que o runner escolhesse. O timeout maior é porque ler a planilha inteira e gravar
  // 305 registros um a um passa dos 60s do playwright.config.
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async () => {
    test.setTimeout(300_000)
    reiniciarBanco()
    // Piso do teste seguinte: se o reset não tivesse limpado, "não gravou nada" seria
    // verdade por acidente.
    expect((await contagens()).total).toBe(0)
  })

  test('a prévia mostra os totais corretos e não grava nada', async ({ page }) => {
    await analisar(page)

    await expect(cartao(page, 'ativos')).toHaveText(String(ESPERADO.ativos))
    await expect(cartao(page, 'devolvidos')).toHaveText(String(ESPERADO.devolvidos))
    await expect(cartao(page, 'perdidos')).toHaveText(String(ESPERADO.perdidos))
    await expect(cartao(page, 'aConfirmar')).toHaveText(String(ESPERADO.aConfirmar))
    // A tela conta as duplicatas das duas origens num cartão só.
    await expect(cartao(page, 'possiveisDuplicatas')).toHaveText(
      String(ESPERADO.ativosDuplicados + ESPERADO.devolucoesDuplicadas),
    )

    // O botão de confirmar anuncia o total que será gravado.
    await expect(
      page.getByRole('button', { name: `Confirmar importação de ${ESPERADO.totalImportado} registros` }),
    ).toBeVisible()

    // Nenhum fornecedor novo: os apelidos do seed cobriram todas as grafias da planilha
    await expect(page.getByText(/Fornecedores que serão criados/)).toHaveCount(0)
    await expect(page.getByText(/Linhas não interpretadas/)).toHaveCount(0)

    // Nada foi gravado ainda. Se isto falhar, a importação está gravando antes da
    // confirmação — bug sério, não é o teste que está errado.
    expect(await contagens()).toMatchObject({ total: 0 })
  })

  test('confirmar grava os registros', async ({ page }) => {
    await analisar(page)

    await page.getByRole('button', { name: /Confirmar importação/ }).click()
    await expect(page.getByTestId('importacao-concluida')).toBeVisible({ timeout: 240_000 })
    await expect(page.getByTestId('importacao-concluida')).toContainText(
      `${ESPERADO.totalImportado} locações criadas, 0 já existiam`,
    )

    expect(await contagens()).toEqual({
      total: ESPERADO.totalImportado,
      ativos: ESPERADO.ativos,
      devolvidos: ESPERADO.devolvidos,
      perdidos: ESPERADO.perdidos,
      aConfirmar: ESPERADO.aConfirmar,
      possiveisDuplicatas: ESPERADO.ativosDuplicados + ESPERADO.devolucoesDuplicadas,
    })
  })

  test('reimportar não duplica', async ({ page }) => {
    await analisar(page)

    await page.getByRole('button', { name: /Confirmar importação/ }).click()
    await expect(page.getByTestId('importacao-concluida')).toBeVisible({ timeout: 240_000 })
    await expect(page.getByTestId('importacao-concluida')).toContainText(
      `0 locações criadas, ${ESPERADO.totalImportado} já existiam`,
    )

    // O banco continua com exatamente o que a primeira importação deixou.
    expect(await contagens()).toEqual({
      total: ESPERADO.totalImportado,
      ativos: ESPERADO.ativos,
      devolvidos: ESPERADO.devolvidos,
      perdidos: ESPERADO.perdidos,
      aConfirmar: ESPERADO.aConfirmar,
      possiveisDuplicatas: ESPERADO.ativosDuplicados + ESPERADO.devolucoesDuplicadas,
    })
  })
})
