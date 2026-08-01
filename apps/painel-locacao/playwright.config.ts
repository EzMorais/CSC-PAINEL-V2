import { defineConfig, devices } from '@playwright/test'
import { ARQUIVO_SESSAO } from './e2e/apoio'

// Vários agentes rodam a suíte no mesmo host. Sem a variável, dois runs simultâneos
// disputariam a 3100 e um deles falaria com o servidor do outro (reuseExistingServer
// é false, mas quem chega depois encontra a porta ocupada).
const PORTA = Number(process.env.PORTA_E2E ?? 3100)
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

  // Os três tamanhos que a construtora realmente usa. O celular não é decoração: o
  // painel é consultado no canteiro, e uma tela que rola de lado lá é inútil.
  projects: [
    // Faz o login uma vez e grava o cookie; os três projetos abaixo partem dele. Sem
    // isto toda navegação cairia em /entrar, e as suítes de layout e importação
    // precisariam autenticar uma a uma.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: ARQUIVO_SESSAO },
      dependencies: ['setup'],
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, storageState: ARQUIVO_SESSAO },
      dependencies: ['setup'],
    },
    // Perfil do Pixel 7 (user agent móvel, toque, deviceScaleFactor) com a largura
    // baixada de 412 para 390. 390 é a largura da faixa de celulares mais estreita em
    // uso — iPhone 12/13/14 e similares. Testar em 412 deixaria passar um estouro que
    // só aparece nos 22 px a menos, e é justamente o aparelho de campo que não pode
    // quebrar. A altura acompanha a proporção desses aparelhos.
    {
      name: 'celular',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, storageState: ARQUIVO_SESSAO },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    // Duas defesas contra a mesma falha, encontrada de forma independente por dois
    // workers: numa cópia limpa do repositório o teste.db não existe, o servidor responde
    // 500 (P2021, "The table main.Locacao does not exist") e o Playwright desiste em 120 s
    // sem rodar um teste sequer — uma falha que não diz nada sobre a causa.
    //
    // 1. O banco é criado NO PRÓPRIO comando, antes do Next subir. Deixar isso para o
    //    `reiniciarBanco()` do primeiro beforeAll chega tarde demais, porque o servidor já
    //    está de pé antes do primeiro teste rodar.
    // DATABASE_URL não é prefixado inline em cada comando (`VAR=valor cmd`): essa
    // sintaxe é POSIX-only e quebra no cmd.exe do Windows. O campo `env` abaixo já
    // aplica a variável ao processo inteiro, incluindo os três comandos encadeados.
    command:
      `npx prisma migrate deploy && ` +
      `npx tsx prisma/seed.ts && ` +
      `npm run dev -- --port ${PORTA}`,
    // 2. A sonda de prontidão aponta para /importar, que renderiza sem tocar no banco.
    //    Assim ela mede o que precisa medir — se o Next está de pé — em vez de medir se o
    //    banco respondeu. Mantida junto com a preparação acima: se um dia a página passar a
    //    consultar dados, ou o seed falhar, a suíte ainda sobe e falha no teste certo.
    url: `${BASE}/importar`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: 'file:./teste.db' },
  },
})
