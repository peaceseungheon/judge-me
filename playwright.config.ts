import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  reporter: 'line',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'
  },
  webServer: {
    command: 'node .output/server/index.mjs',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      HOST: '127.0.0.1',
      PORT: '3000',
      NODE_ENV: 'development',
      NUXT_SESSION_PASSWORD: process.env.NUXT_SESSION_PASSWORD ?? 'test-session-password-at-least-32-chars',
      NUXT_SESSION_COOKIE_SECURE: 'false',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://judge_me:judge_me@localhost:5433/judge_me?schema=public'
    }
  }
})
