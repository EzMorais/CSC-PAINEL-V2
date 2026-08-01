import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './testes',
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3000/entrar',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
