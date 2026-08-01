import { chromium } from '@playwright/test'

const RH = 'http://localhost:3002'
const PAINEL = 'http://localhost:3000'
let falhas = 0
const checa = (c, t) => { if (!c) falhas++; console.log(`  [${c ? 'OK  ' : 'FALHA'}] ${t}`) }

const browser = await chromium.launch()

console.log('\n1) RH SEM SESSÃO')
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  for (const r of ['/', '/funcionarios', '/obras', '/epis', '/configuracoes']) {
    await page.goto(RH + r, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    checa(new URL(page.url()).pathname === '/entrar', `${r} → /entrar`)
  }
  checa((await page.getByTestId('navegacao').count()) === 0, 'navegação não renderiza')
  await ctx.close()
}

console.log('\n2) LOGIN COMPARTILHADO — entra no PAINEL (:3000), navega para o RH (:3002)')
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto(PAINEL + '/entrar', { timeout: 120_000 })
  await page.getByLabel('E-mail').fill('admin@siqueiracampos.com.br')
  await page.getByLabel('Senha').fill('locacao2026')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByTestId('navegacao').waitFor({ timeout: 120_000 })
  checa(true, 'entrou no painel de locação (:3000)')

  // sem logar de novo:
  await page.goto(RH + '/', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  checa(new URL(page.url()).pathname === '/', 'RH abriu SEM segundo login (cookie atravessa a porta)')
  await page.getByTestId('kpis').waitFor({ timeout: 60_000 })
  checa(true, 'dashboard do RH renderizou')
  await ctx.close()
}

console.log('\n3) DADOS DO SEED NA TELA')
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(RH + '/entrar', { timeout: 120_000 })
  await page.getByLabel('E-mail').fill('admin@siqueiracampos.com.br')
  await page.getByLabel('Senha').fill('locacao2026')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByTestId('kpis').waitFor({ timeout: 120_000 })
  checa(true, 'login direto no RH também funciona')

  const kpis = await page.getByTestId('kpis').innerText()
  console.log('    KPIs:', kpis.replace(/\n+/g, ' | '))

  await page.goto(RH + '/funcionarios', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  const contagem = (await page.getByTestId('contagem').textContent())?.trim()
  checa(contagem === '14 funcionários', `listagem: ${contagem}`)

  // busca
  await page.getByTestId('busca').fill('JOÃO')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.waitForURL('**/funcionarios?*', { timeout: 60_000 })
  const depois = (await page.getByTestId('contagem').textContent())?.trim()
  checa(depois === '1 funcionário', `busca por "JOÃO": ${depois}`)

  // filtro de status
  await page.goto(RH + '/funcionarios?status=FERIAS', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  const ferias = (await page.getByTestId('contagem').textContent())?.trim()
  checa(ferias === '1 funcionário', `filtro FÉRIAS: ${ferias}`)

  // detalhe + timeline
  await page.goto(RH + '/funcionarios', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.getByRole('link', { name: 'JOÃO BATISTA SILVEIRA' }).first().click()
  await page.getByTestId('nome-funcionario').waitFor({ timeout: 60_000 })
  checa(true, 'abriu o detalhe do funcionário')
  const timeline = await page.getByTestId('timeline').locator('li').count()
  checa(timeline >= 1, `timeline tem ${timeline} evento(s) — admissão registrada pelo seed`)

  await page.goto(RH + '/obras', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  checa((await page.getByTestId('tabela-obras').count()) === 1, 'tela de obras renderiza')

  await ctx.close()
}

console.log('\n4) CPF INVÁLIDO É RECUSADO')
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(RH + '/entrar', { timeout: 120_000 })
  await page.getByLabel('E-mail').fill('admin@siqueiracampos.com.br')
  await page.getByLabel('Senha').fill('locacao2026')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByTestId('kpis').waitFor({ timeout: 120_000 })

  await page.goto(RH + '/funcionarios/novo', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.getByLabel('Nome completo *').fill('TESTE CPF INVALIDO')
  await page.getByLabel('CPF *').fill('111.111.111-11')
  await page.getByTestId('salvar').click()
  await page.getByTestId('erro-form').waitFor({ timeout: 60_000 })
  const erro = (await page.getByTestId('erro-form').textContent())?.trim()
  checa(!!erro && erro.includes('CPF'), `recusou CPF inválido: "${erro}"`)
  checa(new URL(page.url()).pathname === '/funcionarios/novo', 'continuou no formulário')
  await ctx.close()
}

await browser.close()
console.log(`\n${falhas === 0 ? 'TUDO PASSOU' : falhas + ' FALHA(S)'}`)
process.exit(falhas === 0 ? 0 : 1)
