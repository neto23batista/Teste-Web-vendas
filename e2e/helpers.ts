import { expect, type Page } from "@playwright/test";

// Contas demo criadas pelo seed (prisma/seed.ts).
export const DEMO_CLIENT = {
  email: "cliente@farmavida.local",
  password: process.env.SEED_CUSTOMER_PASSWORD ?? "seed-password-not-configured",
};
export const DEMO_ADMIN = {
  email: "owner@farmavida.local",
  password: process.env.SEED_OWNER_PASSWORD ?? "seed-password-not-configured",
};

/**
 * Specs que ESCREVEM no banco (pedido, salvar perfil) só rodam com
 * E2E_ALLOW_WRITES=I_UNDERSTAND_THIS_IS_A_DISPOSABLE_DATABASE e uma
 * E2E_DATABASE_URL separada. No CI o Postgres de serviço é descartável.
 */
export const ALLOW_WRITES =
  process.env.E2E_ALLOW_WRITES ===
  "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_DATABASE";

/** Faz login e espera sair da página de login. */
export async function login(
  page: Page,
  account: { email: string; password: string } = DEMO_CLIENT
) {
  await page.goto("/login");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // O login redireciona para fora de /login (conta, admin ou home).
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}
