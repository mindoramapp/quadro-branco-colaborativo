import { defineConfig, devices } from '@playwright/test'

const port = 4555

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  // Local: usa o Google Chrome do sistema (sem baixar navegador). CI: Chromium do Playwright.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' },
    },
  ],
  webServer: {
    command: 'npm run build && npm start',
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: String(port), ROOM_SECRET: 'segredo-e2e', DB_PATH: './data/e2e.db' },
  },
})
