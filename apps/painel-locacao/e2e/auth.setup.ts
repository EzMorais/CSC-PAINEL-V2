import { expect, test as setup } from '@playwright/test'
import { ARQUIVO_SESSAO, USUARIO_TESTE } from './apoio'

/**
 * Faz o login uma vez e guarda o cookie para os três projetos de tela.
 *
 * A alternativa seria autenticar dentro de cada teste, o que somaria um round-trip de
 * bcrypt a cada um dos 57 e obrigaria a mexer no corpo de suítes que hoje só falam de
 * layout e de importação. Aqui elas continuam começando já autenticadas, como antes de
 * existir login, e o que muda é só a preparação.
 *
 * O cookie é um JWT: `lerSessao()` valida a assinatura sem consultar o banco. Por isso
 * ele sobrevive ao `reiniciarBanco()` que as suítes rodam depois — o usuário é recriado
 * com outro id, e a sessão continua válida mesmo assim.
 */
setup('autentica e guarda a sessão', async ({ page }) => {
  await page.goto('/entrar')

  await page.getByLabel('E-mail').fill(USUARIO_TESTE.email)
  await page.getByLabel('Senha').fill(USUARIO_TESTE.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()

  // Só grava depois de confirmar que entrou: um storageState com cookie inválido faria
  // todas as suítes falharem redirecionadas para /entrar, longe da causa.
  await page.waitForURL('**/', { timeout: 120_000 })
  await expect(page.getByTestId('navegacao')).toBeVisible({ timeout: 120_000 })

  await page.context().storageState({ path: ARQUIVO_SESSAO })
})
