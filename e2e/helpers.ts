import { expect, type Page } from "@playwright/test";

// Conta demo criada pelo seed (prisma/seed.ts).
export const DEMO_CLIENT = {
  email: "cliente@farmavida.local",
  password: "Cliente@2026",
};

/** Faz login com a conta demo e espera sair da página de login. */
export async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(DEMO_CLIENT.email);
  await page.locator("#password").fill(DEMO_CLIENT.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // O login redireciona para fora de /login (conta ou home).
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}
