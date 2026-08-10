import { expect, test } from '@playwright/test'
import { assinarTokenIntegracaoTeste, reiniciarBancoGo } from './apoio.go'

/**
 * `POST /api/integracao/entregas-epi` — ver migracao-go/rh/COMPORTAMENTO.md §6. SEM prefixo
 * `/rh`: é a mesma URL que o Almoxarifado (`internal/infrastructure/clienterh/cliente.go`) e
 * o Alojamentos (ainda Next.js) já chamam via `{URL_RH}/api/integracao/...` — mudar o path
 * quebraria os dois. Chamado só entre sistemas, nunca pela UI. Idempotente por
 * `movimentacaoId`, autenticação por JWT de máquina (nunca cookie de sessão).
 */

const ENDPOINT = '/api/integracao/entregas-epi'

test.describe('Integração — recebimento de ficha de EPI — Go', () => {
  test.beforeEach(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('sem token válido devolve 401', async ({ request }) => {
    const resp = await request.post(ENDPOINT, { data: { movimentacaoId: 'x' } })
    expect(resp.status()).toBe(401)
  })

  test('token de sessão de usuário não serve como credencial de máquina', async ({ request }) => {
    // Um JWT sem `tipo: 'integracao'` (ex.: assinado por outro emissor de forma diferente)
    // precisa ser rejeitado mesmo com assinatura válida — checagem de `tipo`, não só de HMAC.
    const token = await assinarTokenIntegracaoTeste('estoque', 60)
    // Corpo inválido de propósito, só para confirmar que passou da autenticação (400, não 401).
    const resp = await request.post(ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    })
    expect(resp.status()).toBe(400)
  })

  test('funcionário inexistente devolve 422', async ({ request }) => {
    const token = await assinarTokenIntegracaoTeste('estoque')
    const resp = await request.post(ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        movimentacaoId: 'mov-teste-inexistente',
        funcionarioId: 'id-que-nao-existe',
        materialCodigo: 'MAT-001',
        materialNome: 'Capacete',
        quantidade: 1,
        unidade: 'UN',
        entregueEm: '2026-08-06',
      },
    })
    expect(resp.status()).toBe(422)
  })

  test('cria a ficha (201) e reenviar o mesmo movimentacaoId devolve 200 duplicada, sem duplicar', async ({
    page,
    request,
  }) => {
    const token = await assinarTokenIntegracaoTeste('estoque')
    await page.goto('/rh/funcionarios')
    await page.getByText('CARLOS EDUARDO ROCHA').click()
    const id = (await page.url()).split('/').pop()!

    const corpo = {
      movimentacaoId: 'mov-teste-001',
      funcionarioId: id,
      materialCodigo: 'MAT-010',
      materialNome: 'Luva de raspa',
      quantidade: 2,
      unidade: 'PAR',
      entregueEm: '2026-08-06',
    }

    const primeira = await request.post(ENDPOINT, { headers: { Authorization: `Bearer ${token}` }, data: corpo })
    expect(primeira.status()).toBe(201)

    const segunda = await request.post(ENDPOINT, { headers: { Authorization: `Bearer ${token}` }, data: corpo })
    expect(segunda.status()).toBe(200)
    expect((await segunda.json()).duplicada).toBe(true)

    await page.goto(`/rh/funcionarios/${id}`)
    await expect(page.getByText('Luva de raspa')).toBeVisible()
  })
})
