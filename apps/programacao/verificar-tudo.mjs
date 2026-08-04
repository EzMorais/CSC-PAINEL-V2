/** Confere as três frentes desta rodada: clientes na programação, RH (excluir/importar) e tema escuro. */
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('../frota/node_modules/playwright-core')
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
let falhas = 0
function ok(nome, cond, extra = '') {
  console.log(`${cond ? 'OK   ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`)
  if (!cond) falhas++
}

const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1400, height: 950 } })
const p = await ctx.newPage()
const errosJs = []
p.on('pageerror', (e) => errosJs.push(e.message))

const NOME_TESTE = `CLIENTE TESTE ${Date.now().toString().slice(-5)}`

try {
  await p.goto('http://localhost:3004/entrar', { waitUntil: 'networkidle' })
  await p.fill('#email', 'admin@siqueiracampos.com.br')
  await p.fill('#senha', 'locacao2026')
  await p.click('button[type=submit]')
  await p.waitForURL((u) => !u.pathname.includes('/entrar'), { timeout: 20000 })

  // ── 1. Clientes na programação ────────────────────────────────────────────
  await p.goto('http://localhost:3007/frentes', { waitUntil: 'networkidle' })
  ok('tela de clientes abre', await p.locator('[data-testid=lista-frentes]').isVisible())
  const antes = await p.locator('[data-testid=lista-frentes] > li').count()

  await p.click('[data-testid=nova-frente]')
  await p.fill('#nome', NOME_TESTE)
  await p.click('[data-testid=salvar-frente]')
  await p.waitForTimeout(2000)
  const depois = await p.locator('[data-testid=lista-frentes] > li').count()
  ok('adicionar cliente novo', depois === antes + 1, `${antes} → ${depois}`)
  ok('  aparece na lista', await p.locator(`text=${NOME_TESTE}`).first().isVisible())

  // Nome repetido é recusado
  await p.click('[data-testid=nova-frente]')
  await p.fill('#nome', NOME_TESTE)
  await p.click('[data-testid=salvar-frente]')
  await p.waitForTimeout(1500)
  const msg = await p.locator('[data-testid=erro-frente]').textContent().catch(() => '')
  ok('nome repetido é recusado', /[Jj]á existe/.test(msg ?? ''), msg?.trim())
  await p.locator('button:has-text("Cancelar")').first().click()

  // O cliente novo aparece no quadro
  await p.goto('http://localhost:3007/dia/2026-12-20', { waitUntil: 'networkidle' })
  ok('cliente novo vira coluna no quadro',
    await p.locator(`text=${NOME_TESTE}`).first().isVisible().catch(() => false))

  // ── 2. RH: importar e excluir ─────────────────────────────────────────────
  await p.goto('http://localhost:3002/funcionarios', { waitUntil: 'networkidle' })
  ok('botão de importar planilha aparece',
    await p.locator('[data-testid=importar-planilha]').isVisible().catch(() => false))

  await p.click('[data-testid=importar-planilha]')
  await p.waitForURL('**/funcionarios/importar', { timeout: 20000 })
  ok('tela de importação abre', await p.locator('[data-testid=arquivo-planilha]').isVisible())

  // Excluir: cria alguém limpo e apaga; depois tenta em alguém com histórico.
  const limpo = await prismaRh(`
    INSERT INTO Funcionario (id, nome, cpf, matricula, admitidoEm, status, tipoContrato, criadoEm, atualizadoEm)
    VALUES ('teste-excluir', 'ZEZINHO DE TESTE', '52998224725', 'SC-9999',
            '2026-01-01T00:00:00.000Z', 'ATIVO', 'CLT', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
  `)
  if (limpo) {
    await p.goto('http://localhost:3002/funcionarios/teste-excluir', { waitUntil: 'networkidle' })
    ok('botão de excluir aparece para admin',
      await p.locator('[data-testid=excluir-funcionario]').isVisible().catch(() => false))
    await p.click('[data-testid=excluir-funcionario]')
    await p.waitForTimeout(1500)
    const podeConfirmar = await p.locator('[data-testid=confirmar-exclusao]').isVisible().catch(() => false)
    ok('  sem histórico, deixa excluir', podeConfirmar)
    if (podeConfirmar) {
      await p.click('[data-testid=confirmar-exclusao]')
      await p.waitForURL('**/funcionarios', { timeout: 20000 })
      const sumiu = !(await p.locator('text=ZEZINHO DE TESTE').first().isVisible().catch(() => false))
      ok('  o cadastro some da lista', sumiu)
    }
  }

  // Alguém com entrega de EPI não pode ser excluído
  const comEpi = await primeiroComEpi()
  if (comEpi) {
    await p.goto(`http://localhost:3002/funcionarios/${comEpi}`, { waitUntil: 'networkidle' })
    await p.click('[data-testid=excluir-funcionario]')
    await p.waitForTimeout(1500)
    const barrado = !(await p.locator('[data-testid=confirmar-exclusao]').isVisible().catch(() => false))
    ok('com histórico, a exclusão é barrada', barrado)
    ok('  e explica o porquê',
      await p.locator('text=prova de que a empresa').first().isVisible().catch(() => false))
  } else {
    console.log('     (ninguém com entrega de EPI no banco — parte não exercitada)')
  }

  // ── 3. Tema escuro em todos ───────────────────────────────────────────────
  const modulos = [
    ['Portal', 'http://localhost:3004/'],
    ['Locação', 'http://localhost:3001/'],
    ['RH', 'http://localhost:3002/'],
    ['Almoxarifado', 'http://localhost:3003/'],
    ['Alojamentos', 'http://localhost:3005/'],
    ['Programação', 'http://localhost:3007/'],
    ['Frota', 'http://localhost:3000/veiculos'],
  ]

  for (const [nome, url] of modulos) {
    await p.goto(url, { waitUntil: 'networkidle' })
    const temBotao = await p.locator('[data-testid=tema], button[aria-label*="tema" i], button[aria-label*="escuro" i], button[aria-label*="claro" i]')
      .first().isVisible().catch(() => false)

    await p.evaluate(() => localStorage.setItem('theme', 'dark'))
    await p.reload({ waitUntil: 'networkidle' })
    const temClasse = await p.evaluate(() => document.documentElement.classList.contains('dark'))
    const fundo = await p.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const escuro = (() => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(fundo)
      if (!m) return false
      return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 < 90
    })()

    ok(`${nome}: tema escuro`, temBotao && temClasse && escuro,
      `botão=${temBotao} classe=${temClasse} fundo=${fundo}`)

    await p.evaluate(() => localStorage.removeItem('theme'))
  }
} finally {
  await nav.close()
  await prisma.frente.deleteMany({ where: { nome: NOME_TESTE } })
  await prisma.programacao.deleteMany({ where: { data: new Date('2026-12-20T00:00:00Z') } })
  await prisma.$disconnect()
  console.log('\n(dados de teste removidos)')
}

async function prismaRh(sql) {
  const { PrismaClient: RhClient } = await import('../rh/node_modules/@prisma/client/index.js')
  const rh = new RhClient({ datasources: { db: { url: 'file:../rh/prisma/dev.db' } } })
  try { await rh.$executeRawUnsafe(sql); return true }
  catch (e) { console.log('     (não deu para criar o funcionário de teste:', e.message.split('\n')[0], ')'); return false }
  finally { await rh.$disconnect() }
}

async function primeiroComEpi() {
  const { PrismaClient: RhClient } = await import('../rh/node_modules/@prisma/client/index.js')
  const rh = new RhClient({ datasources: { db: { url: 'file:../rh/prisma/dev.db' } } })
  try {
    const e = await rh.entregaEpi.findFirst({ select: { funcionarioId: true } })
    return e?.funcionarioId ?? null
  } catch { return null } finally { await rh.$disconnect() }
}

if (errosJs.length) {
  console.log('\nErros de JavaScript:')
  for (const e of [...new Set(errosJs)].slice(0, 5)) console.log('  ' + e)
  falhas++
}
process.exit(falhas === 0 ? 0 : 1)
