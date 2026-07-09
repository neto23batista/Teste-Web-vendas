import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Saídas de build alternativas (distDir via NEXT_BUILD_DIST: .next-prod, .next-e2e, .next-verify…)
    ".next-*/**",
    // Worktrees temporários de agente (têm .next próprio — nunca lintar):
    ".claude/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts Node (CommonJS) de utilidade/QA:
    "scripts/**",
    "prisma/seed.ts",
    // Conector InovaFarma: Node puro, roda no PC da farmácia (fora do app Next)
    "connector/**",
  ]),
]);

export default eslintConfig;
