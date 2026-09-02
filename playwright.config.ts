import { defineConfig, devices } from "@playwright/test";
import {
  assertDisposableTestDatabase,
  assertLocalTestServer,
} from "./src/lib/operations/test-database-safety";

const PORT = 3210;
// Por padrão usa o dev na 3210; PW_BASE_URL permite apontar para outro servidor
// já em execução (ex.: o build de produção), reusado com PW_NO_SERVER=1.
const BASE_URL = process.env.PW_BASE_URL || `http://localhost:${PORT}`;
const isCI = !!process.env.CI;
const WRITE_CONFIRMATION = "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_DATABASE";
const writesRequested = process.env.E2E_ALLOW_WRITES;
const allowWrites = writesRequested === WRITE_CONFIRMATION;
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;

if (writesRequested && !allowWrites) {
  throw new Error(
    `E2E_ALLOW_WRITES deve ser exatamente ${WRITE_CONFIRMATION}.`,
  );
}

if (allowWrites && !e2eDatabaseUrl) {
  throw new Error(
    "Testes E2E de escrita exigem E2E_DATABASE_URL apontando para um banco descartável.",
  );
}

if (allowWrites && process.env.PW_NO_SERVER) {
  throw new Error(
    "Testes E2E de escrita não podem reutilizar servidor externo (PW_NO_SERVER).",
  );
}

if (allowWrites) {
  assertDisposableTestDatabase({
    url: e2eDatabaseUrl,
    confirmation: writesRequested,
    appEnv: process.env.APP_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
  if (process.env.E2E_DATABASE_URL_UNPOOLED) {
    assertDisposableTestDatabase({
      url: process.env.E2E_DATABASE_URL_UNPOOLED,
      confirmation: writesRequested,
      appEnv: process.env.APP_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });
  }
  assertLocalTestServer(BASE_URL);
}

/**
 * Config de E2E.
 * - Local: usa o Microsoft Edge do sistema (`channel: "msedge"`) para NÃO
 *   baixar o Chromium — mesmo binário do scripts/qa/screenshots.cjs. ATENÇÃO: o banco
 *   local deve ser separado de produção; specs que ESCREVEM (pedido, salvar
 *   perfil) exigem confirmação explícita e E2E_DATABASE_URL descartável.
 * - CI: Chromium baixado pelo Playwright + Postgres de serviço descartável
 *   (migrado e semeado no workflow), com a confirmação explícita habilitada.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  // No Actions, além do log textual, publica cada falha como anotação do job.
  // Assim o diagnóstico continua acessível mesmo sem baixar o artefato de trace.
  reporter: isCI ? [["github"], ["list"]] : [["list"]],
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
      : {
          name: "edge",
          use: { ...devices["Desktop Edge"], channel: "msedge" },
        },
  ],
  // Por padrão o Playwright sobe o app sozinho (dev local; em CI o
  // PW_WEB_COMMAND aponta para o build de produção — CSP estrita ativa).
  // Defina PW_NO_SERVER=1 para reusar um servidor já em execução.
  webServer: process.env.PW_NO_SERVER
    ? undefined
    : {
        command: process.env.PW_WEB_COMMAND || `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !isCI && !allowWrites,
        timeout: 240_000,
        env: e2eDatabaseUrl
          ? {
              DATABASE_URL: e2eDatabaseUrl,
              DATABASE_URL_UNPOOLED:
                process.env.E2E_DATABASE_URL_UNPOOLED ?? e2eDatabaseUrl,
            }
          : undefined,
      },
});
