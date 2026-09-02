import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { assertDisposableTestDatabase } from "./src/lib/operations/test-database-safety";

const databaseUrl = assertDisposableTestDatabase({
  url: process.env.INTEGRATION_DATABASE_URL,
  confirmation: process.env.INTEGRATION_ALLOW_WRITES,
  appEnv: process.env.APP_ENV,
  vercelEnv: process.env.VERCEL_ENV,
});

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["integration/**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: { DATABASE_URL: databaseUrl, DATABASE_URL_UNPOOLED: databaseUrl },
  },
});
