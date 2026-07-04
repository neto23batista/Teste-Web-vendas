import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
// Por padrão usa o dev na 3210; PW_BASE_URL permite apontar para outro servidor
// já em execução (ex.: o build de produção), reusado com PW_NO_SERVER=1.
const BASE_URL = process.env.PW_BASE_URL || `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

/**
 * Config de E2E.
 * - Local: usa o Microsoft Edge do sistema (`channel: "msedge"`) para NÃO
 *   baixar o Chromium — mesmo binário do scripts/shot.cjs. ATENÇÃO: o banco
 *   local é o MESMO Postgres/Neon de produção; specs que ESCREVEM (pedido,
 *   salvar perfil) só rodam com E2E_ALLOW_WRITES=1.
 * - CI: Chromium baixado pelo Playwright + Postgres de serviço descartável
 *   (migrado e semeado no workflow), onde E2E_ALLOW_WRITES=1 é seguro.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    isCI
      ? { name: "chromium", use: { ...devices["Desktop Chrome"] } }
      : { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
  ],
  // Por padrão o Playwright sobe o app sozinho (dev local; em CI o
  // PW_WEB_COMMAND aponta para o build de produção — CSP estrita ativa).
  // Defina PW_NO_SERVER=1 para reusar um servidor já em execução.
  webServer: process.env.PW_NO_SERVER
    ? undefined
    : {
        command:
          process.env.PW_WEB_COMMAND || `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !isCI,
        timeout: 240_000,
      },
});
