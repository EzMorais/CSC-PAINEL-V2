import { expect, test, type Page } from '@playwright/test'
import { reiniciarBancoGo } from './apoio.go'

/**
 * O ciclo completo de uma locação: registrar → renovar → transferir → devolver — contra o
 * Painel de Locação em Go. Ver migracao-go/painel/COMPORTAMENTO.md §4.3.
 *
 * O que este arquivo protege, por extenso: devolver NÃO pode apagar/recriar a linha — a
 * `dataInicio` original tem que sobreviver, o `id` tem que ser o mesmo, e "permaneceu N
 * dias na obra" no histórico tem que ser contado a partir do início ORIGINAL, não do fim
 * (que a renovação e a transferência já mudaram). Por isso a locação nasce com início 45
 * dias atrás, não hoje: com início hoje, "permaneceu 0 dias" passaria mesmo se a data
 * tivesse sido sobrescrita, e o teste não distinguiria comportamento correto de bug.
 *
 * Interação diferente do Next.js original de propósito: aqui não há drawer nem dialogs —
 * clicar na locação NAVEGA pra uma página de detalhe de verdade, e Renovar/Transferir/
 * Devolver são formulários expansíveis (<details>) na própria página, não modais. A
 * asserção de negócio (mesmo id, dataInicio preservada, histórico com as 4 etapas) é
 * idêntica; só o transporte mudou — servidor-renderizado, sem JavaScript de estado.
 */

const EQUIPAMENTO = 'BETONEIRA DE TESTE GO 400L'
const TR = 'GOTESTE-001'
const VALOR = '650'
const DIAS_ANTES = 45
const DIAS_RENOVACAO = 15
const MOTIVO_TRANSFERENCIA = 'teste automatizado go'
const MOTIVO_DEVOLUCAO = 'fim da obra'

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d))
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)
}

/** "2026-06-17" → "17/06/2026", igual ao que dominio.DataBR imprime na tela. */
function br(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

async function abrirLocacao(page: Page) {
  await page.goto('/painel/locacoes')
  await page.getByRole('link', { name: new RegExp(EQUIPAMENTO) }).click()
  await expect(page.getByRole('heading', { name: EQUIPAMENTO })).toBeVisible()
}

let HOJE = ''
let INICIO = ''
let FIM_REGISTRO = ''
let FIM_TRANSFERENCIA = ''
let DIA_DEVOLUCAO = ''
let LOCACAO_URL = ''
let OBRA_ORIGEM = ''
let OBRA_DESTINO = ''

test.describe('Ciclo de vida de uma locação — Go', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('registrar cria a locação com movimentação de registro', async ({ page }) => {
    await page.goto('/painel/locacoes/nova')

    HOJE = await page.locator('#dataInicio').inputValue()
    INICIO = somarDias(HOJE, -DIAS_ANTES)
    FIM_REGISTRO = somarDias(INICIO, 30)

    await page.getByLabel('Obra *').selectOption({ index: 1 })
    const obraTexto = await page.getByLabel('Obra *').locator('option:checked').innerText()
    OBRA_ORIGEM = obraTexto

    await page.getByLabel('Equipamento *').fill(EQUIPAMENTO)
    await page.getByLabel('Código Tr').fill(TR)
    await page.getByLabel('Fornecedor').selectOption({ index: 1 })
    await page.getByLabel('Valor do item (R$)').fill(VALOR)
    await page.locator('#dataInicio').fill(INICIO)
    await page.locator('#dataFim').fill(FIM_REGISTRO)

    await page.getByRole('button', { name: 'Registrar locação' }).click()
    await page.waitForURL('**/painel/locacoes')

    await abrirLocacao(page)
    LOCACAO_URL = page.url()

    await expect(page.getByText('R$ 650,00')).toBeVisible()
    // .first(): o mesmo texto de período aparece no resumo (<dd>) e repetido dentro da
    // linha do histórico ("Registrada de ... a ...") — as duas ocorrências concordando já
    // é a prova de que o período gravado está certo.
    await expect(page.getByText(`${br(INICIO)} a ${br(FIM_REGISTRO)}`).first()).toBeVisible()
    await expect(page.getByTestId('historico')).toContainText(`Registrada de ${br(INICIO)} a ${br(FIM_REGISTRO)}`)
  })

  test('renovar estende o prazo e registra no histórico', async ({ page }) => {
    await page.goto(LOCACAO_URL)
    await page.getByTestId('abrir-renovar').click()
    await page.getByLabel('Dias a acrescentar').fill(String(DIAS_RENOVACAO))
    await page.locator('form:has(#diasExtras)').getByRole('button', { name: 'Confirmar' }).click()
    await page.waitForURL(LOCACAO_URL)

    const fimRenovado = somarDias(FIM_REGISTRO, DIAS_RENOVACAO)
    await expect(page.getByTestId('historico')).toContainText(`Renovada por ${DIAS_RENOVACAO} dias — novo fim ${br(fimRenovado)}`)
    // O registro anterior continua ali: renovar acrescenta, não substitui.
    await expect(page.getByTestId('historico')).toContainText(`Registrada de ${br(INICIO)} a ${br(FIM_REGISTRO)}`)
  })

  test('transferir muda a obra e registra origem e destino', async ({ page }) => {
    await page.goto(LOCACAO_URL)
    await page.getByTestId('abrir-transferir').click()

    const destinoSelect = page.locator('#obraDestinoId')
    await destinoSelect.selectOption({ index: 0 })
    OBRA_DESTINO = await destinoSelect.locator('option:checked').innerText()
    expect(OBRA_DESTINO).not.toBe(OBRA_ORIGEM)

    // O campo já vem preenchido com o início original — não mexe nele, só no fim.
    await expect(page.locator('#transfInicio')).toHaveValue(INICIO)

    FIM_TRANSFERENCIA = somarDias(HOJE, 120)
    await page.locator('#transfFim').fill(FIM_TRANSFERENCIA)
    await page.locator('#transfMotivo').fill(MOTIVO_TRANSFERENCIA)
    await page.locator('form:has(#obraDestinoId)').getByRole('button', { name: 'Confirmar' }).click()
    await page.waitForURL(LOCACAO_URL)

    await expect(page.locator('header')).toContainText(OBRA_DESTINO)
    await expect(page.getByTestId('historico')).toContainText(
      `novo período ${br(INICIO)} a ${br(FIM_TRANSFERENCIA)} · ${MOTIVO_TRANSFERENCIA}`,
    )

    // O início continua sendo o original — é o que garante a conta de "permaneceu N dias"
    // no fim partir do dia certo, não de quando a transferência aconteceu. `.first()`: o
    // mesmo texto aparece no resumo e repetido dentro da linha do histórico.
    await expect(page.getByText(`${br(INICIO)} a ${br(FIM_TRANSFERENCIA)}`).first()).toBeVisible()
  })

  test('devolver preserva a data de início e calcula os dias na obra', async ({ page }) => {
    await page.goto(LOCACAO_URL)
    await page.getByTestId('abrir-devolver').click()

    DIA_DEVOLUCAO = await page.locator('#dataDevolucao').inputValue()
    await page.locator('#devMotivo').fill(MOTIVO_DEVOLUCAO)
    await page.locator('form:has(#dataDevolucao)').getByRole('button', { name: 'Confirmar' }).click()
    await page.waitForURL(LOCACAO_URL)

    const permanencia = diasEntre(INICIO, DIA_DEVOLUCAO)
    expect(permanencia).toBe(DIAS_ANTES)

    const historico = page.getByTestId('historico')
    await expect(historico).toContainText(
      `Devolvida em ${br(DIA_DEVOLUCAO)} — permaneceu ${permanencia} dias na obra · ${MOTIVO_DEVOLUCAO}`,
    )
    // As quatro etapas continuam registradas depois da devolução — o coração do teste.
    await expect(historico).toContainText(`Registrada de ${br(INICIO)}`)
    await expect(historico).toContainText(`Renovada por ${DIAS_RENOVACAO} dias`)
    await expect(historico).toContainText('Transferida de')
    await expect(page.getByRole('heading', { name: /Histórico \(4\)/ })).toBeVisible()

    // Some da lista padrão (em aberto)...
    await page.goto('/painel/locacoes')
    await expect(page.getByRole('link', { name: new RegExp(EQUIPAMENTO) })).toHaveCount(0)
    // ...e aparece no filtro de devolvidas.
    await page.goto('/painel/locacoes?status=DEVOLVIDA')
    await expect(page.getByRole('link', { name: new RegExp(EQUIPAMENTO) })).toHaveCount(1)
  })

  test('devolvida não oferece mais ações', async ({ page }) => {
    await page.goto(LOCACAO_URL)
    await expect(page.getByTestId('abrir-renovar')).toHaveCount(0)
    await expect(page.getByTestId('abrir-transferir')).toHaveCount(0)
    await expect(page.getByTestId('abrir-devolver')).toHaveCount(0)
    // O histórico continua acessível — o item vira leitura, não desaparece.
    await expect(page.getByTestId('historico')).toBeVisible()
  })
})
