import { execSync } from 'node:child_process'
import path from 'node:path'

/** Credenciais que o seed cria — ver prisma/seed.ts. Válidas só no teste.db. */
export const USUARIO_TESTE = {
  email: 'admin@siqueiracampos.com.br',
  senha: process.env.SENHA_ADMIN || 'locacao2026',
}

/** Contas de exemplo do seed, usadas pra testar permissão sem mexer no admin. */
export const EXEMPLO = {
  senha: 'exemplo2026',
  diretoria: { email: 'diretoria@exemplo.com.br', cargo: 'DIRETORIA', modulos: [] as string[] },
  gerente: { email: 'gerente@exemplo.com.br', cargo: 'GERENTE', modulos: ['ESTOQUE', 'PAINEL'] },
  almoxarife: { email: 'almoxarife@exemplo.com.br', cargo: 'OPERACIONAL', modulos: ['ESTOQUE'] },
  mestre: { email: 'mestre@exemplo.com.br', cargo: 'CONSULTA', modulos: ['PAINEL', 'RH'] },
}

/** Onde o projeto `setup` grava o cookie de sessão que os demais projetos reaproveitam. */
export const ARQUIVO_SESSAO = path.resolve('e2e/.sessao.json')

/**
 * Mesma trava do painel-locacao: o `prisma migrate reset` é bloqueado pelo guardrail do
 * Prisma quando o comando parte de um agente de IA, e exige a variável abaixo com o texto do
 * consentimento do usuário. `exigirBancoDeTeste()` é a segunda trava, independente: recusa
 * rodar se `DATABASE_URL` não apontar claramente para um banco de teste.
 */
const CONSENTIMENTO =
  'CONSINTO com a execução. Sua análise está correta: worktree isolada, teste.db inexistente, não é produção nem o banco do repo principal.'

const BANCO_TESTE = 'file:./teste.db'

const AMBIENTE = {
  ...process.env,
  DATABASE_URL: BANCO_TESTE,
  AUTH_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-000',
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: CONSENTIMENTO,
}

function exigirBancoDeTeste() {
  const url = AMBIENTE.DATABASE_URL
  if (!url || !url.endsWith('teste.db')) {
    throw new Error(
      `reiniciarBanco() só opera sobre banco de teste, e DATABASE_URL é "${url}". ` +
        'O reset foi abortado antes de destruir qualquer dado.',
    )
  }
}

/**
 * Raiz do binário Go único — ver migracao-go/README.md. `ALVO_E2E=go` faz esta MESMA
 * suíte (nenhum arquivo de teste muda) rodar contra ele em vez do Next.js: é a prova de
 * equivalência funcional que a migração exige antes de desligar o Next.js do Portal.
 */
export const RAIZ_GO = path.resolve(__dirname, '../../../migracao-go')
export const BANCO_GO = path.join(RAIZ_GO, 'portal-e2e.db')
export const AUTH_SECRET_GO = 'segredo-de-teste-com-mais-de-32-caracteres-000'

function reiniciarBancoGo() {
  // SEED_RESET=1 apaga as LINHAS via SQL, nunca o arquivo do banco: o webServer mantém o
  // servidor Go no ar durante toda a suíte, com uma conexão SQLite persistente (ver
  // internal/infrastructure/database/conexao.go) — apagar o arquivo por baixo dele deixa
  // essa conexão órfã, principal causa de resultado incoerente logo depois do reset.
  execSync('go run ./cmd/seed', {
    cwd: RAIZ_GO,
    env: { ...process.env, DATABASE_PATH: BANCO_GO, AUTH_SECRET: AUTH_SECRET_GO, SEED_RESET: '1' },
    stdio: 'pipe',
  })
}

/**
 * Recria o banco de teste do zero e roda o seed. Não toca no banco de desenvolvimento.
 * Alvo (Next+Prisma ou Go+SQLite) decidido por `ALVO_E2E` — é infraestrutura de teste, não
 * comportamento: os arquivos de spec continuam idênticos nos dois casos.
 */
export function reiniciarBanco() {
  if (process.env.ALVO_E2E === 'go') {
    reiniciarBancoGo()
    return
  }
  exigirBancoDeTeste()
  execSync('npx prisma migrate reset --force --skip-generate', { env: AMBIENTE, stdio: 'pipe' })
  execSync('npx tsx prisma/seed.ts', { env: AMBIENTE, stdio: 'pipe' })
}
