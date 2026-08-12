import { defineConfig, devices } from '@playwright/test'
import {
  ARQUIVO_SESSAO_GO,
  AUTH_SECRET_GO,
  BANCO_GO,
  BASE_GATEWAY,
  PORTA_GATEWAY,
  PORTA_PROGRAMACAO,
  RAIZ_GO,
} from './e2e/apoio.go'

/**
 * Roda a Programação Next.js legada através do gateway Go, exatamente como o usuário usa
 * em /programacao. Isso garante que o prefixo, a sessão única e a rota da data fixa não
 * voltem a apontar para a implementação Go despublicada.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.go\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-gateway' }]],
  timeout: 60_000,

  use: {
    baseURL: BASE_GATEWAY,
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

  webServer: [
    {
      command: 'go run ./cmd/seed && go run ./cmd/servidor',
      cwd: RAIZ_GO,
      url: `${BASE_GATEWAY}/entrar`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        DATABASE_PATH: BANCO_GO,
        AUTH_SECRET: AUTH_SECRET_GO,
        PORTA: String(PORTA_GATEWAY),
        PROGRAMACAO_UPSTREAM: `http://localhost:${PORTA_PROGRAMACAO}`,
        SEED_RESET: '1',
      },
    },
    {
      command:
        `node scripts/preparar-banco-e2e.mjs && ` +
        `npm run db:seed && ` +
        `npx next dev --port ${PORTA_PROGRAMACAO}`,
      cwd: __dirname,
      url: `http://localhost:${PORTA_PROGRAMACAO}/programacao/marca-icone.png`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        DATABASE_URL: 'file:./programacao-e2e.db',
        AUTH_SECRET: AUTH_SECRET_GO,
        NEXT_DIST_DIR: '.next-e2e-gateway',
        NEXT_PUBLIC_BASE_PATH: '/programacao',
        NEXT_PUBLIC_URL_APP: `${BASE_GATEWAY}/programacao`,
        NEXT_PUBLIC_URL_PORTAL: BASE_GATEWAY,
        NEXT_PUBLIC_URL_PROGRAMACAO: `${BASE_GATEWAY}/programacao`,
        URL_RH: BASE_GATEWAY,
        URL_FROTA: `${BASE_GATEWAY}/frota`,
        URL_PORTAL: BASE_GATEWAY,
      },
    },
  ],
})
