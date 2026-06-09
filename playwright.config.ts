import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
// Por padrão usa o dev na 3210; PW_BASE_URL permite apontar para outro servidor
// já em execução (ex.: o build de produção), reusado com PW_NO_SERVER=1.
const BASE_URL = process.env.PW_BASE_URL || `http://localhost:${PORT}`;

/**
 * Config de E2E. Usa o Microsoft Edge instalado no sistema (`channel: "msedge"`)
 * para NÃO baixar o Chromium do Playwright — mesmo binário do scripts/shot.cjs.
 * Pré-requisito: MySQL (XAMPP) no ar com o banco semeado (`npm run db:seed`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    channel: "msedge",
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
  // Por padrão o Playwright sobe o app sozinho. Defina PW_NO_SERVER=1 para
  // reusar um `npm run dev -- --port 3210` já em execução (útil no Windows,
  // onde o Turbopack/.next pode conflitar ao ser iniciado por outro processo).
  webServer: process.env.PW_NO_SERVER
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
