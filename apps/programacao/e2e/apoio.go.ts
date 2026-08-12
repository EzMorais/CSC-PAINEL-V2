import path from 'node:path'

/**
 * Suporte da suíte que atravessa o gateway Go e a Programação Next.js legada. A URL que o
 * usuário acessa continua sendo a do gateway; a porta do Next só existe dentro do teste.
 */
export const RAIZ_GO = path.resolve(__dirname, '../../../migracao-go')
export const BANCO_GO = path.join(RAIZ_GO, 'programacao-e2e.db')
export const AUTH_SECRET_GO = 'segredo-de-teste-com-mais-de-32-caracteres-000'
export const ARQUIVO_SESSAO_GO = path.resolve(__dirname, '.sessao-go.json')
export const PORTA_GATEWAY = Number(process.env.PORTA_E2E_GO ?? 3305)
export const PORTA_PROGRAMACAO = Number(process.env.PORTA_E2E_PROGRAMACAO ?? 3307)
export const BASE_GATEWAY = `http://localhost:${PORTA_GATEWAY}`

export const USUARIO_TESTE = {
  email: 'admin@siqueiracampos.com.br',
  senha: process.env.SENHA_ADMIN || 'locacao2026',
}
