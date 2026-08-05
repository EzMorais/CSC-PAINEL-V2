import { execSync } from 'node:child_process'
import path from 'node:path'

/**
 * Suporte da suíte que roda contra o binário Go único (`playwright.go.config.ts`) — ver
 * migracao-go/README.md "Como os testes de referência funcionam". Mesmo padrão de
 * apps/painel-locacao/e2e/apoio.go.ts: especificações NOVAS (`*.go.spec.ts`), não uma cópia
 * dos `.spec.ts` originais — a interação é servidor-renderizada (página de detalhe em vez de
 * drawer/dialogs). Ver migracao-go/estoque/COMPORTAMENTO.md.
 */

export const RAIZ_GO = path.resolve(__dirname, '../../../migracao-go')
export const BANCO_GO = path.join(RAIZ_GO, 'estoque-e2e.db')
export const AUTH_SECRET_GO = 'segredo-de-teste-com-mais-de-32-caracteres-000'
export const ARQUIVO_SESSAO_GO = path.resolve(__dirname, '.sessao-go.json')

export const USUARIO_TESTE = {
  email: 'admin@siqueiracampos.com.br',
  senha: process.env.SENHA_ADMIN || 'locacao2026',
}

/** Cargo OPERACIONAL: lança, mas não aprova — usado pra exercitar a fila de aprovação. */
export const USUARIO_ALMOXARIFE = { email: 'almoxarife@exemplo.com.br', senha: 'exemplo2026' }

/** Cargo GERENTE: aprova o que outra pessoa lançou (nunca o próprio pedido). */
export const USUARIO_GERENTE = { email: 'gerente@exemplo.com.br', senha: 'exemplo2026' }

/**
 * Reseta via SQL (nunca apagando o arquivo do banco — o servidor mantém uma conexão
 * persistente, ver migracao-go/internal/infrastructure/database/conexao.go) e roda o seed
 * do binário único, que semeia identidade (admin + contas de exemplo) e os materiais/
 * movimentações/solicitação/aprovação fictícios do Almoxarifado (ver cmd/seed/main.go
 * `semearEstoque`).
 */
export function reiniciarBancoGo() {
  execSync('go run ./cmd/seed', {
    cwd: RAIZ_GO,
    env: { ...process.env, DATABASE_PATH: BANCO_GO, AUTH_SECRET: AUTH_SECRET_GO, SEED_RESET: '1' },
    stdio: 'pipe',
  })
}
