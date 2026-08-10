import { expect, test } from '@playwright/test'
import { ESPERADO, assinarTokenIntegracaoTeste, reiniciarBancoGo } from './apoio.go'

/**
 * `GET /api/integracao/funcionarios` e `GET /api/integracao/resumo` — ver
 * migracao-go/rh/COMPORTAMENTO.md §6. SEM prefixo `/rh` — mesma URL que o Alojamentos (ainda
 * Next.js) já chama via `{URL_RH}/api/integracao/...`. Consumidas pelo Almoxarifado,
 * Alojamentos e Portal. Minimização de dado pessoal: nunca CPF/salário/endereço/telefone.
 */

test.describe('Integração — leitura de funcionários e resumo — Go', () => {
  test.beforeAll(async () => {
    test.setTimeout(120_000)
    reiniciarBancoGo()
  })

  test('funcionários — exclui desligados e nunca expõe CPF/salário/endereço/telefone', async ({ request }) => {
    const token = await assinarTokenIntegracaoTeste('alojamentos')
    const resp = await request.get('/api/integracao/funcionarios', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(resp.ok()).toBe(true)
    const corpo = await resp.json()

    const nomes = corpo.funcionarios.map((f: { nome: string }) => f.nome)
    expect(nomes).not.toContain('MARIA DE LOURDES RAMOS') // é a única DESLIGADA no seed
    expect(corpo.funcionarios).toHaveLength(ESPERADO.funcionarios - ESPERADO.desligados)

    const chaves = Object.keys(corpo.funcionarios[0])
    for (const proibido of ['cpf', 'salario', 'endereco', 'telefone', 'cep', 'logradouro']) {
      expect(chaves).not.toContain(proibido)
    }
  })

  test('resumo devolve indicadores formatados para o dashboard do Portal', async ({ request }) => {
    const token = await assinarTokenIntegracaoTeste('portal')
    const resp = await request.get('/api/integracao/resumo', { headers: { Authorization: `Bearer ${token}` } })
    expect(resp.ok()).toBe(true)
    const corpo = await resp.json()
    expect(Array.isArray(corpo.indicadores)).toBe(true)
    expect(corpo.indicadores[0]).toHaveProperty('rotulo')
    expect(corpo.indicadores[0]).toHaveProperty('valor')
  })

  test('sem token válido, os dois endpoints devolvem 401', async ({ request }) => {
    const r1 = await request.get('/api/integracao/funcionarios')
    const r2 = await request.get('/api/integracao/resumo')
    expect(r1.status()).toBe(401)
    expect(r2.status()).toBe(401)
  })
})
