import { defineConfig, devices } from '@playwright/test'
import { ARQUIVO_SESSAO } from './e2e/apoio'

// Mesmo raciocínio do painel-locacao: vários agentes podem rodar a suíte no mesmo host,
// e uma porta fixa faria dois runs simultâneos disputarem o mesmo servidor.
const PORTA = Number(process.env.PORTA_E2E ?? 3104)
const BASE = `http://localhost:${PORTA}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,

  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    // Autentica uma vez e grava o cookie; as suítes que não testam o próprio fluxo de
    // login partem daqui — ver e2e/autenticacao.spec.ts para quem roda deslogado.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: ARQUIVO_SESSAO },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    // O banco de teste é preparado ANTES do Next subir, no próprio comando — deixar pra
    // um beforeAll chegaria tarde, porque o servidor de prontidão já teria respondido.
    command:
      `npx prisma migrate deploy && ` +
      `npx tsx prisma/seed.ts && ` +
      `npm run dev -- --port ${PORTA}`,
    url: `${BASE}/entrar`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: 'file:./teste.db', AUTH_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-000' },
  },
})
