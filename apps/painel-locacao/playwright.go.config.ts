import { defineConfig, devices } from '@playwright/test'
import { ARQUIVO_SESSAO_GO, RAIZ_GO, BANCO_GO, AUTH_SECRET_GO } from './e2e/apoio.go'

/**
 * Roda a suíte NOVA (`e2e/*.go.spec.ts`) contra o binário Go único — ver
 * migracao-go/README.md. Módulo Painel de Locação, montado sob /painel no mesmo processo
 * que a identidade (antigo Portal).
 */
process.env.ALVO_E2E = 'go'

const PORTA = Number(process.env.PORTA_E2E_GO ?? 3301)
const BASE = `http://localhost:${PORTA}`

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.go\.spec\.ts/,
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
    { name: 'setup', testMatch: /auth\.setup\.go\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: ARQUIVO_SESSAO_GO },
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
