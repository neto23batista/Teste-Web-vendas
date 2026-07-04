import { expect, type Page } from "@playwright/test";

// Contas demo criadas pelo seed (prisma/seed.ts).
export const DEMO_CLIENT = {
  email: "cliente@farmavida.local",
  password: "Cliente@2026",
};
export const DEMO_ADMIN = {
  email: "owner@farmavida.local",
  password: "Dono@Farma2026",
};

/**
 * Specs que ESCREVEM no banco (pedido, salvar perfil) só rodam com
 * E2E_ALLOW_WRITES=1 — localmente o banco é o MESMO de produção (Neon);
 * no CI o Postgres é de serviço, descartável, e a flag fica sempre ligada.
 */
export const ALLOW_WRITES = !!process.env.E2E_ALLOW_WRITES;

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
