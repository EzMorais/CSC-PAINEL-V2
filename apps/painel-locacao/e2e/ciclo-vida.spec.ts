import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { ESPERADO, PLANILHA, reiniciarBanco } from './apoio'

/**
 * O ciclo completo de uma locação: registrar → renovar → transferir → devolver.
 *
 * O que este arquivo protege é uma coisa só, e vale dizer por extenso: na planilha antiga,
 * devolver um equipamento APAGAVA a linha do bloco de itens ativos e a recriava no bloco
 * DEVOLUÇÕES com a data de início sobrescrita pela data da devolução. É por isso que as 63
 * devoluções importadas têm início igual a fim — o tempo real que o equipamento passou na
 * obra foi destruído no ato de registrar que ele voltou.
 *
 * Aqui a locação é levada pelas quatro etapas e, depois de devolvida, o teste exige que:
 *   - as quatro etapas continuem legíveis no histórico;
 *   - a linha continue sendo A MESMA no banco (mesmo id) e com a `dataInicio` original;
 *   - o histórico diga "permaneceu N dias na obra" com N calculado do início original.
 *
 * Por isso a locação é registrada com início 45 dias ATRÁS, e não hoje: com início hoje,
 * "permaneceu 0 dias" passaria mesmo se a data tivesse sido sobrescrita, e o teste não
 * distinguiria o comportamento correto do bug que ele existe para impedir.
 */

const EQUIPAMENTO = 'BETONEIRA DE TESTE 400L'
const TR = 'TESTE-001'
const VALOR = '650'
const DIAS_ANTES = 45
const DIAS_RENOVACAO = 15
const MOTIVO_TRANSFERENCIA = 'teste automatizado'
const MOTIVO_DEVOLUCAO = 'fim da obra'

/** Caminho absoluto do banco de teste: o cliente resolve o relativo a partir do schema. */
const URL_TESTE = `file:${path.resolve('prisma/teste.db')}`

/**
 * Carrega a base real da construtora no banco de teste, chamando a action de importação.
 *
 * Roda em subprocesso, e não no processo do runner, por duas razões que se somam: o
 * transformador do Playwright não compila os módulos de `src/` alcançados por `import()`
 * dinâmico (o require cru estoura em "Cannot use import statement outside a module"), e o
 * singleton de `src/lib/prisma.ts` lê `DATABASE_URL` no instante em que é carregado — num
 * subprocesso a variável é posta antes de qualquer coisa, sem depender de ordem de imports.
 * Custa ~1,5s, contra ~1min de subir a planilha pela tela.
 */
function importarBase(): { criadas: number; puladas: number; fornecedoresCriados: number } {
  const script =
    "import('./src/actions/importar').then(async (m) => {" +
    ' const r = await (m.default ?? m).confirmarImportacao(process.env.PLANILHA_E2E);' +
    ' console.log(JSON.stringify(r));' +
    ' process.exit(r.ok ? 0 : 1) })'

  // No Windows, `npx` é `npx.cmd`, e desde a correção da CVE-2024-27980 o Node recusa
  // rodar .cmd/.bat sem `shell: true` (EINVAL) — mas `shell: true` concatena os args sem
  // escapar (DEP0190), e o `script` inline tem aspas e parênteses que saem truncados.
  // Chamar o `tsx` pelo `node` evita as duas coisas: `node` é sempre um .exe de verdade
  // em qualquer plataforma, então nem shell nem resolução de .cmd entram em jogo.
  const cliDoTsx = path.resolve('node_modules/tsx/dist/cli.mjs')
  const saida = execFileSync(process.execPath, [cliDoTsx, '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'file:./teste.db', PLANILHA_E2E: PLANILHA },
  })
  return JSON.parse(saida.trim().split('\n').pop() ?? '{}').dados
}

async function noBanco<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = new PrismaClient({ datasources: { db: { url: URL_TESTE } } })
  try {
    return await fn(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

/** Soma dias de calendário sobre "yyyy-mm-dd" em UTC — o referencial em que o banco grava. */
function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d))
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)
}

/** "2026-06-17" → "17/06/2026", igual ao que `dataBR` imprime na tela. */
function br(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function iso(data: Date | null): string {
  return data ? data.toISOString().slice(0, 10) : ''
}

/**
 * A linha do equipamento na listagem.
 *
 * `exact` não é zelo excessivo: a tabela renderiza duas árvores, cards no mobile e tabela no
 * desktop, e o botão do card tem a descrição junto de obra, fornecedor e Tr no nome acessível.
 * Sem `exact`, o localizador casaria com os dois e o teste morreria em modo estrito quando o
 * viewport mudasse.
 */
/**
 * Localiza a locação na listagem, nos dois layouts.
 *
 * No desktop a linha é um botão cujo nome acessível é só a descrição. Abaixo de 1024px a
 * listagem vira cards e o mesmo botão engloba obra, fornecedor e etiqueta de vencimento —
 * o nome deixa de ser exato. Buscar por nome exato passava no desktop e falhava em tablet
 * e celular, que é justamente onde a equipe usa o painel em campo.
 *
 * O escopo `visible=true` é necessário porque os dois contêineres existem no DOM ao mesmo
 * tempo: um é escondido por CSS conforme a largura, não removido.
 */
function linha(page: Page): Locator {
  return page
    .locator('[data-testid="tabela-locacoes"], [data-testid="lista-cards"]')
    .locator('visible=true')
    .getByRole('button')
    .filter({ hasText: EQUIPAMENTO })
}

/** Abre o drawer da locação e espera o conteúdo — não o "Carregando..." — estar na tela. */
async function abrirDrawer(page: Page): Promise<Locator> {
  await linha(page).click()
  const drawer = page.getByTestId('drawer-locacao')
  await expect(drawer.getByRole('heading', { name: EQUIPAMENTO })).toBeVisible()
  return drawer
}

async function abrirHistorico(page: Page): Promise<Locator> {
  const drawer = await abrirDrawer(page)
  await drawer.getByRole('tab', { name: /Histórico/ }).click()
  return page.getByTestId('historico')
}

/** "CLIENTE · OBRA · Tr TESTE-001" → "SC-1135-25B". */
function codigoDaObra(texto: string): string {
  return (texto.split('·')[1] ?? '').trim()
}

// Estado compartilhado entre os testes da série. Nada é escrito à mão: as datas saem do que a
// própria tela ofereceu como "hoje", e os códigos de obra do que o app realmente selecionou.
let HOJE = ''
let INICIO = ''
let FIM_REGISTRO = ''
let FIM_RENOVACAO = ''
let FIM_TRANSFERENCIA = ''
let DIA_DEVOLUCAO = ''
let ID_LOCACAO = ''
let CODIGO_ORIGEM = ''
let CODIGO_DESTINO = ''

test.describe('Ciclo de vida de uma locação', () => {
  // `serial` é requisito, não estilo: cada teste só significa alguma coisa sobre o estado que o
  // anterior deixou. Fora de série, "renovar" rodaria contra uma locação que nunca foi criada.
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async () => {
    test.setTimeout(300_000)
    reiniciarBanco()

    // O ciclo roda por cima da base real da construtora, não de um banco vazio: é o que dá
    // sentido às contagens do fim ("devolver tirou exatamente 1 da lista de ativas e não
    // apagou nenhuma das outras 305 linhas").
    expect(importarBase()).toEqual({
      criadas: ESPERADO.totalImportado,
      puladas: 0,
      fornecedoresCriados: 0,
    })

    // Piso da série: se a base não for a esperada, todas as contagens seguintes seriam lidas
    // contra o número errado, e um teste verde não provaria nada.
    expect(
      await noBanco(async (p) => ({
        total: await p.locacao.count(),
        ativas: await p.locacao.count({ where: { devolvidaEm: null } }),
        devolvidas: await p.locacao.count({ where: { devolvidaEm: { not: null } } }),
        perdidas: await p.locacao.count({ where: { estado: 'PERDIDO' } }),
        aConfirmar: await p.locacao.count({ where: { obraAConfirmar: true } }),
      })),
    ).toEqual({
      total: ESPERADO.totalImportado,
      ativas: ESPERADO.ativos,
      devolvidas: ESPERADO.devolvidos,
      perdidas: ESPERADO.perdidos,
      aConfirmar: ESPERADO.aConfirmar,
    })
  })

  test('registrar cria a locação com movimentação de registro', async ({ page }) => {
    await page.goto('/locacoes/nova')

    // "Hoje" sai do próprio formulário, no fuso do navegador do teste. Calcular no processo do
    // runner arriscaria discordar da tela numa virada de dia entre os dois fusos.
    HOJE = await page.getByLabel('Início *').inputValue()
    INICIO = somarDias(HOJE, -DIAS_ANTES)
    FIM_REGISTRO = somarDias(INICIO, 30)

    await page.getByLabel('Obra *').selectOption({ index: 1 })
    await page.getByLabel('Equipamento *').fill(EQUIPAMENTO)
    await page.getByLabel('Código Tr').fill(TR)
    await page.getByLabel('Fornecedor').selectOption({ index: 1 })
    await page.getByLabel('Valor do item (R$)').fill(VALOR)
    // Início antes do período rápido: o atalho calcula o fim a partir do início já digitado.
    await page.getByLabel('Início *').fill(INICIO)
    await page.getByLabel('Período rápido').selectOption('30')
    await expect(page.getByLabel('Fim *')).toHaveValue(FIM_REGISTRO)

    await page.getByRole('button', { name: 'Registrar locação' }).click()
    await page.waitForURL('**/locacoes')

    await expect(page.getByTestId('contagem')).toHaveText(`${ESPERADO.ativos + 1} itens`)
    await expect(linha(page)).toHaveCount(1)

    const drawer = await abrirDrawer(page)
    await expect(drawer).toContainText('R$ 650,00')
    await expect(drawer).toContainText(`${br(INICIO)} a ${br(FIM_REGISTRO)}`)

    CODIGO_ORIGEM = codigoDaObra((await drawer.locator('header p').innerText()) ?? '')
    expect(CODIGO_ORIGEM).not.toBe('')

    await drawer.getByRole('tab', { name: /Histórico/ }).click()
    await expect(page.getByTestId('historico')).toContainText(
      `Registrada de ${br(INICIO)} a ${br(FIM_REGISTRO)}`,
    )

    // O id de agora é o que a última etapa vai cobrar de volta: se a devolução apagar e recriar
    // a linha, o id muda e o teste do fim quebra.
    const criada = await noBanco((p) => p.locacao.findFirst({ where: { descricao: EQUIPAMENTO } }))
    expect(criada).not.toBeNull()
    ID_LOCACAO = criada!.id
    expect(iso(criada!.dataInicio)).toBe(INICIO)
  })

  test('renovar estende o prazo e registra no histórico', async ({ page }) => {
    await page.goto('/locacoes')
    const drawer = await abrirDrawer(page)

    await drawer.getByRole('button', { name: 'Renovar' }).click()
    const dialog = page.getByTestId('dialog-renovar')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Dias a acrescentar').fill(String(DIAS_RENOVACAO))
    await dialog.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dialog).toBeHidden()

    FIM_RENOVACAO = somarDias(FIM_REGISTRO, DIAS_RENOVACAO)

    const historico = await abrirHistorico(page)
    await expect(historico).toContainText(
      `Renovada por ${DIAS_RENOVACAO} dias — novo fim ${br(FIM_RENOVACAO)}`,
    )
    // O registro anterior continua ali: renovar acrescenta, não substitui.
    await expect(historico).toContainText(`Registrada de ${br(INICIO)} a ${br(FIM_REGISTRO)}`)

    // A renovação move o fim; o início é intocado. É a primeira metade da promessa.
    const l = await noBanco((p) => p.locacao.findUnique({ where: { id: ID_LOCACAO } }))
    expect(iso(l!.dataInicio)).toBe(INICIO)
    expect(iso(l!.dataFim)).toBe(FIM_RENOVACAO)
  })

  test('transferir muda a obra e registra origem e destino', async ({ page }) => {
    await page.goto('/locacoes')
    const drawer = await abrirDrawer(page)

    await drawer.getByRole('button', { name: 'Transferir' }).click()
    const dialog = page.getByTestId('dialog-transferir')
    await expect(dialog).toBeVisible()

    const destino = dialog.getByLabel('Obra de destino *')
    await destino.selectOption({ index: 3 })
    CODIGO_DESTINO = codigoDaObra((await destino.locator('option:checked').innerText()) ?? '')
    expect(CODIGO_DESTINO).not.toBe(CODIGO_ORIGEM)

    // O diálogo já vem com o início original preenchido; a transferência troca a obra e o prazo,
    // não a data em que o equipamento entrou. Confirmar isto aqui é o que garante que a conta de
    // "permaneceu N dias" no fim ainda parta do dia certo.
    await expect(dialog.getByLabel('Início *')).toHaveValue(INICIO)

    FIM_TRANSFERENCIA = somarDias(HOJE, 120)
    await dialog.getByLabel('Fim *').fill(FIM_TRANSFERENCIA)
    await dialog.getByLabel('Motivo').fill(MOTIVO_TRANSFERENCIA)
    await dialog.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dialog).toBeHidden()

    const novoDrawer = await abrirDrawer(page)
    await expect(novoDrawer.locator('header p')).toContainText(CODIGO_DESTINO)
    await expect(novoDrawer.locator('header p')).not.toContainText(CODIGO_ORIGEM)

    await novoDrawer.getByRole('tab', { name: /Histórico/ }).click()
    const historico = page.getByTestId('historico')
    await expect(historico).toContainText(
      `Transferida de ${CODIGO_ORIGEM} para ${CODIGO_DESTINO}` +
        ` — novo período ${br(INICIO)} a ${br(FIM_TRANSFERENCIA)} · ${MOTIVO_TRANSFERENCIA}`,
    )

    const l = await noBanco((p) => p.locacao.findUnique({ where: { id: ID_LOCACAO } }))
    expect(iso(l!.dataInicio)).toBe(INICIO)
  })

  test('devolver preserva a data de início e calcula os dias na obra', async ({ page }) => {
    await page.goto('/locacoes')
    const drawer = await abrirDrawer(page)

    await drawer.getByRole('button', { name: 'Devolver' }).click()
    const dialog = page.getByTestId('dialog-devolver')
    await expect(dialog).toBeVisible()
    // A data proposta pelo diálogo é a que vai para o banco; ler dali evita que o teste calcule
    // "hoje" num fuso e a tela em outro.
    DIA_DEVOLUCAO = await dialog.getByLabel('Data da devolução *').inputValue()
    await dialog.getByLabel('Motivo').fill(MOTIVO_DEVOLUCAO)
    await dialog.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dialog).toBeHidden()

    // Some da lista padrão — e nenhuma das outras linhas some junto.
    await expect(page.getByTestId('contagem')).toHaveText(`${ESPERADO.ativos} itens`)
    await expect(linha(page)).toHaveCount(0)

    // Aparece no filtro de devolvidas, com o histórico completo.
    await page.goto('/locacoes?status=DEVOLVIDA')
    await expect(page.getByTestId('contagem')).toHaveText(`${ESPERADO.devolvidos + 1} itens`)

    const historico = await abrirHistorico(page)

    // O dado que a planilha perdia: o tempo real na obra, contado do início ORIGINAL.
    const permanencia = diasEntre(INICIO, DIA_DEVOLUCAO)
    expect(permanencia).toBe(DIAS_ANTES)
    await expect(historico).toContainText('permaneceu')
    await expect(historico).toContainText('dias na obra')
    await expect(historico).toContainText(
      `Devolvida em ${br(DIA_DEVOLUCAO)} — permaneceu ${permanencia} dias na obra · ${MOTIVO_DEVOLUCAO}`,
    )

    // O coração do teste: as quatro etapas continuam registradas depois da devolução.
    await expect(historico).toContainText(`Registrada de ${br(INICIO)} a ${br(FIM_REGISTRO)}`)
    await expect(historico).toContainText(`Renovada por ${DIAS_RENOVACAO} dias`)
    await expect(historico).toContainText(`Transferida de ${CODIGO_ORIGEM} para ${CODIGO_DESTINO}`)
    await expect(historico.locator('li')).toHaveCount(4)

    // E a mesma prova no banco, onde a planilha falhava: a linha não foi apagada nem recriada
    // (mesmo id), o início continua sendo o de 45 dias atrás, e o resto da base ficou intacto.
    const estado = await noBanco(async (p) => ({
      linhas: await p.locacao.findMany({
        where: { descricao: EQUIPAMENTO },
        include: { movimentacoes: true },
      }),
      total: await p.locacao.count(),
      devolvidas: await p.locacao.count({ where: { devolvidaEm: { not: null } } }),
      ativas: await p.locacao.count({ where: { devolvidaEm: null } }),
    }))

    expect(estado.linhas).toHaveLength(1)
    const l = estado.linhas[0]
    expect(l.id).toBe(ID_LOCACAO)
    expect(iso(l.dataInicio)).toBe(INICIO)
    expect(iso(l.devolvidaEm)).toBe(DIA_DEVOLUCAO)
    expect(iso(l.dataFim)).toBe(FIM_TRANSFERENCIA)
    expect(l.movimentacoes.map((m) => m.tipo).sort()).toEqual([
      'DEVOLUCAO',
      'REGISTRO',
      'RENOVACAO',
      'TRANSFERENCIA',
    ])

    expect(estado.total).toBe(ESPERADO.totalImportado + 1)
    expect(estado.devolvidas).toBe(ESPERADO.devolvidos + 1)
    expect(estado.ativas).toBe(ESPERADO.ativos)
  })

  test('devolvida não oferece mais ações', async ({ page }) => {
    await page.goto('/locacoes?status=DEVOLVIDA')
    const drawer = await abrirDrawer(page)

    await expect(drawer.getByRole('button', { name: 'Editar' })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: 'Renovar' })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: 'Transferir' })).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: 'Devolver' })).toHaveCount(0)

    // O histórico continua acessível — o item vira leitura, não desaparece.
    await expect(drawer.getByRole('tab', { name: /Histórico \(4\)/ })).toBeVisible()
  })
})
