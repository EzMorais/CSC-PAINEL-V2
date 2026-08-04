import { expect, test, type Page } from '@playwright/test'
import { EXEMPLO, USUARIO_TESTE, reiniciarBanco } from './apoio'

/**
 * Linha de base de comportamento pra migração — ver migracao-go/portal/COMPORTAMENTO.md §5-6.
 *
 * Cada teste loga com a conta que precisa em vez de reaproveitar o cookie do projeto
 * `desktop`: o `beforeAll` reseta o banco, e o admin seedado ganha um `id` novo a cada
 * reset — um cookie de sessão gravado antes do reset carregaria o `id` velho, o que
 * quebraria silenciosamente o teste de autoedição (compara `id` da sessão com o da linha).
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Usuários (admin)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBanco()
  })

  /**
   * Espera o redirecionamento pós-login terminar antes de devolver o controle — sem isso,
   * um `goto()` logo em seguida corre contra a navegação do form em andamento e interrompe
   * o login a meio caminho (a sessão nunca é gravada, e o teste volta pro /entrar sem erro
   * nenhum aparecer, o que é enganoso de depurar).
   */
  async function loginComo(page: Page, email: string, senha: string) {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha').fill(senha)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 60_000 }),
      page.getByRole('button', { name: 'Entrar' }).click(),
    ])
  }

  /** Pra tentativas que devem FALHAR — não espera redirecionamento, que nunca vem. */
  async function tentarLoginComo(page: Page, email: string, senha: string) {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha').fill(senha)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByTestId('erro-login')).toBeVisible()
  }

  test('cargo sem podeAdministrar não acessa /usuarios', async ({ page }) => {
    await loginComo(page, EXEMPLO.mestre.email, EXEMPLO.senha)
    await expect(page.getByText('Olá, Marcos')).toBeVisible({ timeout: 60_000 })

    await page.goto('/usuarios', { timeout: 120_000 })
    await expect(page).toHaveURL(/\/$/)
  })

  test('admin vê a lista de usuários — 1 admin + 5 de exemplo do seed', async ({ page }) => {
    await loginComo(page, USUARIO_TESTE.email, USUARIO_TESTE.senha)
    await page.goto('/usuarios')
    await expect(page.getByTestId('lista-usuarios')).toBeVisible()
    await expect(page.getByText(/^6 usuários$/)).toBeVisible()
  })

  test('criar usuário — caminho feliz', async ({ page }) => {
    await loginComo(page, USUARIO_TESTE.email, USUARIO_TESTE.senha)
    await page.goto('/usuarios')

    await page.getByTestId('novo-usuario').click()
    await page.getByLabel('Nome completo *').fill('Novo Usuário de Teste')
    await page.getByLabel('E-mail *').fill('novo.usuario@teste.com')
    await page.getByLabel('Senha inicial *').fill('inicial123')
    await page.getByTestId('salvar-usuario').click()

    // O formulário fecha e a lista cresce — não sobra erro nem o form aberto.
    await expect(page.getByTestId('erro-usuario')).toHaveCount(0)
    await expect(page.getByText(/^7 usuários$/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('novo.usuario@teste.com')).toBeVisible()
  })

  test('criar usuário — e-mail duplicado dá erro amigável', async ({ page }) => {
    await loginComo(page, USUARIO_TESTE.email, USUARIO_TESTE.senha)
    await page.goto('/usuarios')

    await page.getByTestId('novo-usuario').click()
    await page.getByLabel('Nome completo *').fill('Fulano Duplicado')
    // Reusa o e-mail do próprio admin — já existe desde o seed.
    await page.getByLabel('E-mail *').fill(USUARIO_TESTE.email)
    await page.getByLabel('Senha inicial *').fill('qualquercoisa123')
    await page.getByTestId('salvar-usuario').click()

    await expect(page.getByTestId('erro-usuario')).toHaveText('Já existe um usuário com esse e-mail.')
  })

  test('editar usuário — cargo e módulos persistem depois de recarregar', async ({ page }) => {
    await loginComo(page, USUARIO_TESTE.email, USUARIO_TESTE.senha)
    await page.goto('/usuarios')

    // Cria o alvo desta vez, pra não mexer nas contas de exemplo que outros testes leem.
    await page.getByTestId('novo-usuario').click()
    await page.getByLabel('Nome completo *').fill('Editar Alvo')
    await page.getByLabel('E-mail *').fill('editar.alvo@teste.com')
    await page.getByLabel('Senha inicial *').fill('inicial123')
    await page.getByTestId('salvar-usuario').click()
    await expect(page.getByText('editar.alvo@teste.com')).toBeVisible({ timeout: 15_000 })

    // O <select> de Cargo não tem `htmlFor`/`id` ligando ao <label> — escopar pela <li> em
    // vez de getByLabel, que não acharia o controle por associação de acessibilidade.
    const linha = page.locator('li', { hasText: 'editar.alvo@teste.com' })
    await linha.getByTestId('editar-editar.alvo@teste.com').click()
    await linha.getByRole('combobox').selectOption('GERENTE')
    await linha.getByRole('checkbox', { name: 'RH e SST' }).check()
    await linha.getByRole('button', { name: 'Salvar' }).click()
    await expect(linha.getByText('Salvo. O novo cargo vale no próximo login desta pessoa.')).toBeVisible()

    await page.reload()
    const linhaRecarregada = page.locator('li', { hasText: 'editar.alvo@teste.com' })
    await expect(linhaRecarregada.getByText('Gerente / Engenheiro')).toBeVisible()
    await expect(linhaRecarregada.getByText('RH e SST')).toBeVisible()
  })

  test('autoedição bloqueada — botão Editar do próprio admin fica desabilitado', async ({ page }) => {
    await loginComo(page, USUARIO_TESTE.email, USUARIO_TESTE.senha)
    await page.goto('/usuarios')

    const botao = page.getByTestId(`editar-${USUARIO_TESTE.email}`)
    await expect(botao).toBeDisabled()
  })

  test('redefinir senha — a pessoa entra com a senha nova, não com a antiga', async ({ page }) => {
    await loginComo(page, USUARIO_TESTE.email, USUARIO_TESTE.senha)
    await page.goto('/usuarios')

    await page.getByTestId('novo-usuario').click()
    await page.getByLabel('Nome completo *').fill('Senha Alvo')
    await page.getByLabel('E-mail *').fill('senha.alvo@teste.com')
    await page.getByLabel('Senha inicial *').fill('inicial123')
    await page.getByTestId('salvar-usuario').click()
    await expect(page.getByText('senha.alvo@teste.com')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('editar-senha.alvo@teste.com').click()
    await page.getByPlaceholder('Nova senha (8+ caracteres)').fill('novaSenha123')
    await page.getByRole('button', { name: 'Redefinir' }).click()
    await expect(page.getByText('Senha redefinida. Passe a nova senha para a pessoa.')).toBeVisible()

    await page.getByTestId('sair').click()
    await expect(page).toHaveURL(/\/entrar$/)

    // Senha antiga não entra mais.
    await tentarLoginComo(page, 'senha.alvo@teste.com', 'inicial123')

    // Senha nova entra.
    await loginComo(page, 'senha.alvo@teste.com', 'novaSenha123')
    await expect(page.getByText('Olá, Senha')).toBeVisible({ timeout: 60_000 })
  })

  test('últimos acessos mostra a tentativa que falhou e a que passou', async ({ page }) => {
    // A senha antiga de senha.alvo (trocada dois testes atrás) agora falha de propósito.
    await tentarLoginComo(page, 'senha.alvo@teste.com', 'inicial123')

    await loginComo(page, USUARIO_TESTE.email, USUARIO_TESTE.senha)
    await page.goto('/usuarios')

    // O registro mostra o NOME da pessoa, não o e-mail (ver queries/usuarios.ts) — e o
    // teste anterior já deixou uma tentativa igual, então usa `.first()` de propósito:
    // o que importa é que pelo menos uma linha recente exista, não que seja única.
    const acessos = page.getByTestId('ultimos-acessos')
    await expect(acessos.getByText(/falhou.*Senha Alvo/).first()).toBeVisible()
    await expect(acessos.getByText(/entrou.*Administrador/).first()).toBeVisible()
  })
})

test.describe('Hub — visibilidade de módulo por cargo', () => {
  test.describe.configure({ timeout: 120_000 })

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBanco()
  })

  test('CONSULTA com módulos específicos só vê os módulos liberados', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(EXEMPLO.mestre.email)
    await page.getByLabel('Senha').fill(EXEMPLO.senha)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Olá, Marcos')).toBeVisible({ timeout: 60_000 })

    for (const modulo of EXEMPLO.mestre.modulos) {
      await expect(page.getByTestId(`sistema-${modulo}`)).toBeVisible()
    }
    for (const modulo of ['ESTOQUE', 'ALOJAMENTOS', 'FROTA']) {
      await expect(page.getByTestId(`sistema-${modulo}`)).toHaveCount(0)
    }
  })

  test('DIRETORIA vê todos os módulos mesmo sem nenhum AcessoModulo gravado', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel('E-mail').fill(EXEMPLO.diretoria.email)
    await page.getByLabel('Senha').fill(EXEMPLO.senha)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Olá, Carla')).toBeVisible({ timeout: 60_000 })

    for (const modulo of ['PAINEL', 'RH', 'ESTOQUE', 'ALOJAMENTOS', 'FROTA']) {
      await expect(page.getByTestId(`sistema-${modulo}`)).toBeVisible()
    }
  })
})
