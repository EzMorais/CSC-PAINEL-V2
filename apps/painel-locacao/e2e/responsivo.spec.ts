import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { expect, test, type Page } from '@playwright/test'
import { ESPERADO, PLANILHA, reiniciarBanco } from './apoio'

/**
 * O painel é consultado no celular, em pé no canteiro de obra. Se a tela rolar de lado
 * ou a tabela de 8 colunas estourar a largura, o sistema é inútil justamente onde mais
 * precisa funcionar. Esta suíte trava isso nos três tamanhos reais: 390 (celular),
 * 768 (tablet) e 1440 (desktop) — ver os projetos em playwright.config.ts.
 *
 * Todos os testes rodam nos três projetos. O que muda por tamanho está dentro de cada
 * teste, comparando `testInfo.project.name`, e não em arquivos separados: assim uma
 * regra que valha para os três (nunca rolar de lado) é escrita uma vez só.
 */

const PAGINAS = ['/', '/locacoes', '/locacoes/nova', '/obras', '/fornecedores', '/importar']

/** Largura em que a navegação deixa de deslizar e a tabela substitui os cards (Tailwind `lg`). */
const LARGURA_LG = 1024

/**
 * Sobra horizontal do documento. 0 = a página não rola de lado.
 *
 * `scrollWidth - clientWidth` do `documentElement` é a medida certa: `clientWidth` já
 * desconta a barra de rolagem vertical, então uma página alta e bem comportada dá 0 —
 * o que `window.innerWidth` não daria. 1 px de tolerância porque um layout com largura
 * fracionária pode arredondar para cima sem que nada esteja visivelmente errado.
 */
async function sobraHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}

async function semRolagemHorizontal(page: Page, onde: string) {
  expect(await sobraHorizontal(page), `${onde} não deve rolar horizontalmente`).toBeLessThanOrEqual(1)
}

/** Espera a rota carregar. Em dev a primeira visita a cada rota compila sob demanda. */
async function abrir(page: Page, caminho: string) {
  await page.goto(caminho, { timeout: 120_000 })
  await page.waitForLoadState('networkidle', { timeout: 120_000 })
}

/**
 * Contagens do banco de teste, para decidir se ele já está no estado que a suíte espera.
 * Devolve `null` quando o arquivo ainda não existe ou não tem as tabelas — que é o caso
 * na primeira execução, antes de qualquer `reiniciarBanco()`.
 */
async function contagensOuNulo() {
  try {
    return await contagens()
  } catch {
    return null
  }
}

async function contagens() {
  // Caminho absoluto: o cliente resolveria `file:./teste.db` relativo ao schema.
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve('prisma/teste.db')}` } },
  })
  try {
    const [total, ativos] = await Promise.all([
      prisma.locacao.count(),
      prisma.locacao.count({ where: { devolvidaEm: null } }),
    ])
    return { total, ativos }
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Deixa o teste.db com a planilha real dentro. Só reimporta se o banco não estiver no
 * estado esperado: os três projetos compartilham o mesmo teste.db e nenhum teste daqui
 * grava nada, então o primeiro projeto importa e os outros dois aproveitam. Importar
 * 305 registros pela tela leva minutos — repetir isso três vezes seria puro desperdício.
 *
 * A comparação inclui `ativos`, não só o total: uma suíte anterior pode ter devolvido
 * itens sem mudar a contagem geral, e os indicadores conferidos abaixo dependem disso.
 */
async function garantirPlanilhaImportada(base: string, novaPagina: (base: string) => Promise<Page>) {
  const antes = await contagensOuNulo()
  if (antes && antes.total === ESPERADO.totalImportado && antes.ativos === ESPERADO.ativos) return

  reiniciarBanco()
  const page = await novaPagina(base)
  try {
    await page.goto('/importar', { timeout: 120_000 })
    await page.setInputFiles('#planilha', PLANILHA)
    await page.getByRole('button', { name: 'Analisar' }).click()
    await expect(page.getByText('Prévia — nada foi gravado ainda')).toBeVisible({ timeout: 120_000 })
    await page.getByRole('button', { name: /Confirmar importação/ }).click()
    await expect(page.getByTestId('importacao-concluida')).toBeVisible({ timeout: 240_000 })
  } finally {
    await page.close()
  }

  // Piso da suíte inteira: sem os dados reais, "não rola de lado" seria verdade por
  // falta de conteúdo, não por o layout estar certo.
  expect(await contagens()).toEqual({
    total: ESPERADO.totalImportado,
    ativos: ESPERADO.ativos,
  })
}

test.describe('Responsividade', () => {
  // 60 s do config não cobrem uma rota compilando em dev com 305 linhas na tela.
  test.describe.configure({ timeout: 180_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(600_000)

    // `baseURL` é fixture de escopo de teste e não pode ser injetada num beforeAll;
    // `project.use` traz o mesmo valor já resolvido. O fallback repete a regra do
    // config para o caso de a opção não estar exposta nesta versão do Playwright.
    const base =
      test.info().project.use.baseURL ?? `http://localhost:${process.env.PORTA_E2E ?? 3100}`

    await garantirPlanilhaImportada(base, (b) => browser.newPage({ baseURL: b }))

    // Aquecimento: em dev cada rota compila na primeira visita, e essa espera cairia
    // em cima do primeiro teste que a abrisse, mascarando o custo real da medição.
    const page = await browser.newPage({ baseURL: base })
    try {
      for (const caminho of PAGINAS) await abrir(page, caminho)
    } finally {
      await page.close()
    }
  })

  for (const caminho of PAGINAS) {
    test(`${caminho} não rola horizontalmente`, async ({ page }) => {
      await abrir(page, caminho)
      await semRolagemHorizontal(page, caminho)
    })
  }

  test('a navegação se adapta ao tamanho da tela', async ({ page }, testInfo) => {
    await abrir(page, '/')
    const menu = page.getByRole('button', { name: 'Abrir menu' })

    if (testInfo.project.name === 'desktop') {
      // Acima de lg a navegação é uma coluna fixa: nada de hambúrguer.
      await expect(menu).toBeHidden()
      await expect(page.getByTestId('navegacao')).toBeVisible()
    } else {
      await expect(menu).toBeVisible()

      // Fechada, a navegação está fora da tela (translate-x-full), à ESQUERDA do
      // zero. Sobra à esquerda não gera rolagem — e é isso que se confere aqui:
      // o menu escondido não pode alargar a página.
      await semRolagemHorizontal(page, 'a página com o menu fechado')
      const caixaFechada = await page.getByTestId('navegacao').boundingBox()
      expect(caixaFechada!.x + caixaFechada!.width, 'o menu fechado deve estar fora da tela')
        .toBeLessThanOrEqual(1)

      await menu.click()
      const navegacao = page.getByTestId('navegacao')
      await expect(navegacao).toBeVisible()
      await expect(navegacao).toBeInViewport()
      await semRolagemHorizontal(page, 'a página com o menu aberto')

      // O menu deslizante precisa de fato navegar, não só aparecer.
      await navegacao.getByRole('link', { name: 'Locações' }).click()
      await page.waitForURL('**/locacoes', { timeout: 120_000 })
    }
  })

  test('a listagem usa cards no celular e no tablet, e tabela no desktop', async ({ page }, testInfo) => {
    await abrir(page, '/locacoes')

    // O corte é o `lg` do Tailwind (1024). O tablet de 768 fica do lado dos cards.
    const larguraDesteProjeto = page.viewportSize()!.width
    if (larguraDesteProjeto >= LARGURA_LG) {
      await expect(page.getByTestId('tabela-locacoes')).toBeVisible()
      await expect(page.getByTestId('lista-cards')).toBeHidden()
    } else {
      await expect(page.getByTestId('lista-cards')).toBeVisible()
      await expect(page.getByTestId('tabela-locacoes')).toBeHidden()
    }

    // Redundante com o teste de rolagem acima só na aparência: ali a página estava
    // recém-carregada; aqui já se sabe qual das duas apresentações está na tela, então
    // uma falha aponta direto para a culpada.
    await semRolagemHorizontal(page, `/locacoes em ${testInfo.project.name}`)
  })

  /**
   * A regra que o brief mais teme: a tabela de 8 colunas pode ser mais larga que o
   * espaço disponível, e tudo bem — desde que ela role DENTRO do próprio contêiner.
   * O que não pode é a página inteira rolar junto.
   *
   * Roda só no desktop porque é o único projeto onde a tabela está de fato exibida
   * (abaixo de lg o contêiner é `display: none` e todas as medidas dariam zero).
   * A medição principal é feita em 1024 px, a menor largura em que a tabela aparece:
   * em 1440 sobra espaço e o estouro simplesmente não acontece, então testar só lá
   * deixaria a regressão passar.
   */
  test('a tabela rola dentro do próprio contêiner, sem arrastar a página', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'abaixo de lg a tabela não é exibida')

    for (const largura of [LARGURA_LG, 1440]) {
      await page.setViewportSize({ width: largura, height: 900 })
      await abrir(page, '/locacoes')
      await expect(page.getByTestId('tabela-locacoes')).toBeVisible()

      const medida = await page.getByTestId('tabela-locacoes').evaluate((tabela) => {
        let no: HTMLElement | null = tabela.parentElement
        while (no && no !== document.body) {
          const overflowX = getComputedStyle(no).overflowX
          if (overflowX === 'auto' || overflowX === 'scroll') {
            return {
              overflowX,
              larguraTabela: tabela.scrollWidth,
              larguraVisivelDoContainer: no.clientWidth,
            }
          }
          no = no.parentElement
        }
        return null
      })

      expect(medida, `em ${largura}px a tabela precisa estar dentro de um contêiner rolável`)
        .not.toBeNull()
      // O contêiner absorve o excesso: a tabela pode ser mais larga que ele...
      expect(medida!.larguraTabela).toBeGreaterThanOrEqual(medida!.larguraVisivelDoContainer)
      // ...mas o contêiner nunca é mais largo que a tela.
      expect(medida!.larguraVisivelDoContainer).toBeLessThanOrEqual(largura)
      // ...e a página não rola de lado por causa dele.
      await semRolagemHorizontal(page, `/locacoes em ${largura}px`)
    }
  })

  test('os indicadores aparecem em qualquer tamanho', async ({ page }, testInfo) => {
    await abrir(page, '/')
    const kpis = page.getByTestId('kpis')
    await expect(kpis).toBeVisible()
    await expect(kpis).toContainText(String(ESPERADO.ativos))
    await expect(kpis).toBeInViewport()
    await semRolagemHorizontal(page, `o dashboard em ${testInfo.project.name}`)
  })

  test('o drawer de detalhe ocupa a tela inteira no celular', async ({ page }, testInfo) => {
    await abrir(page, '/locacoes')

    const larguraTela = page.viewportSize()!.width
    const alvo =
      larguraTela >= LARGURA_LG
        ? page.getByTestId('tabela-locacoes').locator('tbody button').first()
        : page.getByTestId('lista-cards').getByRole('button').first()

    await alvo.click()
    const drawer = page.getByTestId('drawer-locacao')
    await expect(drawer).toBeVisible()

    const caixa = await drawer.boundingBox()
    if (testInfo.project.name === 'celular') {
      // Tela cheia: no celular não sobra espaço para uma faixa lateral e um resto de
      // lista que ninguém consegue ler.
      expect(caixa!.width, 'no celular o drawer deve ocupar a largura inteira')
        .toBeGreaterThanOrEqual(larguraTela - 2)
    } else {
      // Faixa lateral: no tablet e no desktop a lista continua visível ao lado.
      expect(caixa!.width, 'acima do celular o drawer deve ser uma faixa lateral')
        .toBeLessThan(larguraTela * 0.6)
    }

    // O drawer é `fixed right-0`: se ele escapar da borda direita, a página passa a
    // rolar de lado — exatamente o defeito que esta suíte existe para pegar.
    await semRolagemHorizontal(page, `/locacoes com o drawer aberto em ${testInfo.project.name}`)
  })
})
