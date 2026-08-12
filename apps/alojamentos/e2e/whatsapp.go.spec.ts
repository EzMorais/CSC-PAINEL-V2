import { expect, test } from '@playwright/test'
import { assinarTokenIntegracaoTeste, BASE, reiniciarBancoGo } from './apoio.go'

/**
 * Webhook de WhatsApp do Alojamentos — contra o binário Go
 * (`POST /api/integracao/whatsapp/recebida`, handler WhatsappRecebida em
 * migracao-go/internal/handlers/alojamentos/whatsapp.go). Ver
 * migracao-go/alojamentos/COMPORTAMENTO.md e domain/alojamentos/whatsapp.go
 * (ProximoPasso/PedidoDeGrupo) para o contrato exato.
 *
 * O seed Go NÃO semeia Alojamentos, então esta suíte se auto-semeia pela UI (cria o
 * alojamento, vincula o grupo e aloca o morador com telefone) antes de exercitar o webhook.
 * O token de integração é assinado no próprio teste (`assinarTokenIntegracaoTeste('whatsapp')`
 * — EmissoresValidos do pacote integracao inclui "whatsapp").
 */

test.describe('Webhook WhatsApp — Go', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000)
    reiniciarBancoGo()

    // Auto-semeadura via UI usando a sessão de admin já guardada pelo auth.setup.
    const context = await browser.newContext({ storageState: './e2e/.sessao-go.json' })
    const page = await context.newPage()

    // 1) alojamento
    await page.goto('/alojamentos/cadastros')
    await page.getByText('+ Novo alojamento').click()
    await page.locator('input[name="nome"]').fill(BASE.alojamentoNome)
    await page.locator('input[name="cidade"]').fill('Guarulhos')
    await page.locator('input[name="uf"]').fill('SP')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page).toHaveURL(/\/alojamentos\/cadastros\/[0-9a-f-]+/)

    // 2) vínculo do grupo de WhatsApp no detalhe
    await page.locator('input[name="grupoId"]').fill(BASE.grupoWhatsapp)
    await page.getByRole('button', { name: 'Vincular grupo' }).click()
    await expect(page.locator('input[name="grupoId"]')).toHaveValue(BASE.grupoWhatsapp)

    // 3) morador com telefone (JOÃO BATISTA SILVEIRA vem do seed semearRH)
    await page.goto('/alojamentos/moradores')
    await page.getByText('+ Alocar morador').click()
    await page.locator('select[name="funcionarioId"]').selectOption({ label: BASE.moradorNome })
    await page.locator('select[name="alojamentoId"]').selectOption({ label: BASE.alojamentoNome })
    await page.locator('input[name="dataEntrada"]').fill('2026-08-11')
    await page.locator('select[name="transporte"]').selectOption('PROPRIO')
    await page.locator('input[name="telefone"]').fill(BASE.moradorTelefone)
    await page.getByRole('button', { name: 'Alocar' }).click()
    await expect(page).toHaveURL(/\/alojamentos\/moradores/)
    await expect(page.locator('table tbody')).toContainText(BASE.moradorNome)
    await context.close()
  })

  test('sem token é 401', async ({ request }) => {
    const res = await request.post('/api/integracao/whatsapp/recebida', {
      data: { telefone: BASE.moradorTelefone, texto: 'oi' },
    })
    expect(res.status()).toBe(401)
  })

  test('mensagem de grupo com #pedido cria pedido e responde o número', async ({ request }) => {
    const token = await assinarTokenIntegracaoTeste('whatsapp')
    const res = await request.post('/api/integracao/whatsapp/recebida', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        telefone: BASE.moradorTelefone,
        texto: '#pedido limpeza lixo acumulado na cozinha do refeitório',
        mensagemId: 'grupo-msg-001',
        grupoId: BASE.grupoWhatsapp,
        nomeRemetente: 'JOÃO BATISTA SILVEIRA',
      },
    })
    expect(res.status()).toBe(200)
    const corpo = await res.json()
    expect(corpo.resposta).toMatch(/^Pedido #[0-9a-f]{8} registrado\.$/)
  })

  test('mensagem repetida (mesmo mensagemId) é ignorada', async ({ request }) => {
    const token = await assinarTokenIntegracaoTeste('whatsapp')
    const res = await request.post('/api/integracao/whatsapp/recebida', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        telefone: BASE.moradorTelefone,
        texto: '#pedido limpeza lixo acumulado na cozinha do refeitório',
        mensagemId: 'grupo-msg-001',
        grupoId: BASE.grupoWhatsapp,
      },
    })
    expect(res.status()).toBe(200)
    const corpo = await res.json()
    expect(corpo.resposta).toBeNull()
  })

  test('conversa individual do morador segue o fluxo até criar pedido', async ({ request }) => {
    const token = await assinarTokenIntegracaoTeste('whatsapp')
    const chamar = (texto: string, mensagemId: string) =>
      request.post('/api/integracao/whatsapp/recebida', {
        headers: { Authorization: `Bearer ${token}` },
        data: { telefone: BASE.moradorTelefone, texto, mensagemId },
      })

    // Entrada: número conhecido devolve o menu e salva o passo AGUARDANDO_TIPO.
    const r1 = await chamar('oi', 'ind-001')
    expect(r1.status()).toBe(200)
    const corpo1 = await r1.json()
    expect(corpo1.resposta).toContain('Olá, JOÃO!')
    expect(corpo1.resposta).toContain(`Alojamento ${BASE.alojamentoNome}`)
    expect(corpo1.resposta).toContain('1 - Limpeza')
    expect(corpo1.resposta).toContain('2 - Manutenção')
    expect(corpo1.resposta).toContain('3 - Pessoal')

    // Escolhe tipo 2 (Manutenção).
    const r2 = await chamar('2', 'ind-002')
    const corpo2 = await r2.json()
    expect(corpo2.resposta).toBe('Agora conte o que você precisa, em uma mensagem.')

    // Descreve o problema.
    const r3 = await chamar('porta do banheiro quebrada', 'ind-003')
    const corpo3 = await r3.json()
    expect(corpo3.resposta).toContain('Confere para mim:')
    expect(corpo3.resposta).toContain('porta do banheiro quebrada')

    // Confirma -> cria o pedido de MANUTENCAO.
    const r4 = await chamar('sim', 'ind-004')
    expect(r4.status()).toBe(200)
    const corpo4 = await r4.json()
    expect(corpo4.resposta).toMatch(/^Pronto! Registrei o seu pedido #[0-9a-f]{8}\.$/)
  })

  test('pedido criado pelo WhatsApp aparece na lista de pedidos', async ({ page }) => {
    await page.goto('/alojamentos/pedidos')
    const linha = page.locator('table tbody tr').filter({ hasText: 'porta do banheiro quebrada' })
    await expect(linha).toBeVisible()
    await expect(linha).toContainText('ABERTO')
    await expect(linha).toContainText(BASE.alojamentoNome)
  })

  test('número desconhecido recebe a mensagem padrão', async ({ request }) => {
    const token = await assinarTokenIntegracaoTeste('whatsapp')
    const res = await request.post('/api/integracao/whatsapp/recebida', {
      headers: { Authorization: `Bearer ${token}` },
      data: { telefone: '(99) 99999-9999', texto: 'oi', mensagemId: 'ind-999' },
    })
    expect(res.status()).toBe(200)
    const corpo = await res.json()
    expect(corpo.resposta).toBe(
      'Olá! Não encontrei o seu número no cadastro dos alojamentos. Procure o responsável para cadastrar seu WhatsApp.',
    )
  })

  test('mensagem de grupo sem gatilho #pedido é ignorada', async ({ request }) => {
    const token = await assinarTokenIntegracaoTeste('whatsapp')
    const res = await request.post('/api/integracao/whatsapp/recebida', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        telefone: BASE.moradorTelefone,
        texto: 'bom dia pessoal, lembrando da entrega amanhã',
        mensagemId: 'grupo-msg-002',
        grupoId: BASE.grupoWhatsapp,
      },
    })
    expect(res.status()).toBe(200)
    const corpo = await res.json()
    expect(corpo.resposta).toBeNull()
  })
})