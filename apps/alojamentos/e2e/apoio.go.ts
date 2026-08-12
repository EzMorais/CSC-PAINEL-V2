import { execSync } from 'node:child_process'
import path from 'node:path'
import { SignJWT } from 'jose'

/**
 * Suporte da suíte que roda contra o binário Go único (`playwright.go.config.ts`) — ver
 * migracao-go/README.md "Como os testes de referência funcionam". Mesmo padrão de
 * apps/estoque/e2e/apoio.go.ts.
 *
 * O seed Go (`go run ./cmd/seed`) NÃO semeia dados de Alojamentos — ver cmd/seed/main.go.
 * Portanto esta suíte é auto-semeadora: cria alojamento/quartos/rota/alocação/pedidos direto
 * pela interface no início do describe (`semearBase`), e os testes seguintes trabalham em
 * cima do que a própria suíte criou.
 *
 * O login é com a conta ADMIN do seed (`admin@siqueiracampos.com.br`) porque
 * `identidade.TemAcesso` libera Qualquer módulo pra cargo ADMIN — e Alojamentos não tem
 * conta de exemplo com `ModuloAlojamentos` liberado.
 */

export const RAIZ_GO = path.resolve(__dirname, '../../../migracao-go')
export const BANCO_GO = path.join(RAIZ_GO, 'alojamentos-e2e.db')
export const AUTH_SECRET_GO = 'segredo-de-teste-com-mais-de-32-caracteres-000'
export const ARQUIVO_SESSAO_GO = path.resolve(__dirname, '.sessao-go.json')

export const USUARIO_TESTE = {
  email: 'admin@siqueiracampos.com.br',
  senha: process.env.SENHA_ADMIN || 'locacao2026',
}

/**
 * Assina um token de integração para os testes de `whatsapp.go.spec.ts` — mesmo contrato de
 * `migracao-go/internal/services/integracao/integracao.go`: HS256, `{origem, tipo:
 * 'integracao'}`, validade curta. `EmissoresValidos["whatsapp"]=true` (linha 22).
 */
export async function assinarTokenIntegracaoTeste(origem: string, validadeSegundos = 60): Promise<string> {
  return new SignJWT({ origem, tipo: 'integracao' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${validadeSegundos}s`)
    .sign(new TextEncoder().encode(AUTH_SECRET_GO))
}

/** Reseta via SQL e roda o seed do binário único (identidade + Painel + RH). */
export function reiniciarBancoGo() {
  execSync('go run ./cmd/seed', {
    cwd: RAIZ_GO,
    env: { ...process.env, DATABASE_PATH: BANCO_GO, AUTH_SECRET: AUTH_SECRET_GO, SEED_RESET: '1' },
    stdio: 'pipe',
  })
}

/**
 * Dados de exemplo que esta suíte cria pela UI. Nomes/telefones determinísticos para os
 * testes de WhatsApp conferirem (o repositório normaliza telefone pra dígitos, removendo o
 * prefixo 55 — ver telefoneDigitos em alojamentos_repositorio.go).
 */
export const BASE = {
  alojamentoNome: 'Alojamento Teste E2E',
  numeroQuarto: '101',
  rotaNome: 'Rota E2E Central',
  moradorNome: 'JOÃO BATISTA SILVEIRA',
  moradorTelefone: '(11) 90000-0001',
  grupoWhatsapp: '120363042000000000@g.us',
}