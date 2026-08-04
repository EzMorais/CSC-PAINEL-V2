import { execSync } from 'node:child_process'
import path from 'node:path'

/**
 * Suporte da suíte que roda contra o binário Go único (`playwright.go.config.ts`) — ver
 * migracao-go/README.md "Como os testes de referência funcionam". Arquivo separado de
 * `apoio.ts` de propósito: aquele serve a suíte Next.js original, intocada; esta suíte
 * (`*.go.spec.ts`) testa o mesmo comportamento de negócio contra a implementação em Go, cuja
 * interação é servidor-renderizada (página de detalhe em vez de drawer/dialogs) — por isso
 * são especificações NOVAS, não uma cópia adaptada dos `.spec.ts` originais. Ver
 * migracao-go/painel/COMPORTAMENTO.md.
 */

export const RAIZ_GO = path.resolve(__dirname, '../../../migracao-go')
export const BANCO_GO = path.join(RAIZ_GO, 'painel-e2e.db')
export const AUTH_SECRET_GO = 'segredo-de-teste-com-mais-de-32-caracteres-000'
export const ARQUIVO_SESSAO_GO = path.resolve(__dirname, '.sessao-go.json')

export const USUARIO_TESTE = {
  email: 'admin@siqueiracampos.com.br',
  senha: process.env.SENHA_ADMIN || 'locacao2026',
}

/** Planilha real da construtora — ver migracao-go/painel/COMPORTAMENTO.md §6.8 para os
 * números de referência conferidos célula a célula. */
export const PLANILHA = path.resolve(__dirname, '../dados/Maquinas_Alugadas_Controle_REVISADA.xlsx')

/**
 * Reseta via SQL (nunca apagando o arquivo do banco — o servidor mantém uma conexão
 * persistente, ver migracao-go/internal/infrastructure/database/conexao.go) e roda o seed
 * do binário único, que semeia identidade (admin) e as obras/fornecedores fictícios do
 * Painel (ver cmd/seed/main.go `semearPainel`).
 */
export function reiniciarBancoGo() {
  execSync('go run ./cmd/seed', {
    cwd: RAIZ_GO,
    env: { ...process.env, DATABASE_PATH: BANCO_GO, AUTH_SECRET: AUTH_SECRET_GO, SEED_RESET: '1' },
    stdio: 'pipe',
  })
}
