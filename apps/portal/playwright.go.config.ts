import { defineConfig, devices } from '@playwright/test'
import { ARQUIVO_SESSAO, RAIZ_GO, BANCO_GO, AUTH_SECRET_GO } from './e2e/apoio'

/**
 * Roda a MESMA suíte de e2e/ (nenhum arquivo de teste muda) contra o binário Go único em
 * vez do Portal Next.js — ver migracao-go/README.md "Como os testes de referência
 * funcionam". Isto é a prova de equivalência funcional.
 *
 * `webServer.env` só se aplica ao PROCESSO DO SERVIDOR — os workers que rodam os testes
 * (onde `reiniciarBanco()` de apoio.ts decide qual banco resetar) não herdam aquele objeto,
 * herdam o `process.env` de quando este arquivo de config carrega. Por isso a variável é
 * setada aqui, cedo, e não só dentro de `webServer.env` — sem isto `reiniciarBanco()` cai
 * no branch do Prisma/Next.js por padrão e reseta o banco errado, o teste.db do próprio
 * Portal Next.js, sem erro nenhum aparecer (o teste.db dele é um alvo válido pra função).
 */
process.env.ALVO_E2E = 'go'

const PORTA = Number(process.env.PORTA_E2E_GO ?? 3204)
const BASE = `http://localhost:${PORTA}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-go' }]],
  timeout: 60_000,

  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: ARQUIVO_SESSAO },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'go run ./cmd/seed && go run ./cmd/servidor',
    cwd: RAIZ_GO,
    url: `${BASE}/entrar`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ALVO_E2E: 'go',
      DATABASE_PATH: BANCO_GO,
      AUTH_SECRET: AUTH_SECRET_GO,
      PORTA: String(PORTA),
    },
  },
})
