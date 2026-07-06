import { test, expect } from "@playwright/test";
import { login, DEMO_ADMIN } from "./helpers";

// Painel admin (dono/matriz) — somente leitura.
test.describe("Painel admin", () => {
  test("login do dono abre o dashboard com KPIs", async ({ page }) => {
    await login(page, DEMO_ADMIN);

    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Receita", { exact: true })).toBeVisible();
    await expect(page.getByText("Pedidos por status")).toBeVisible();
  });

  test("telas de estoque e assinaturas carregam", async ({ page }) => {
    await login(page, DEMO_ADMIN);

    await page.goto("/admin/estoque");
    await expect(
      page.getByRole("heading", { name: /estoque/i }).first()
    ).toBeVisible({ timeout: 30_000 });

    await page.goto("/admin/assinaturas");
    await expect(
      page.getByRole("heading", { name: "Assinaturas" })
    ).toBeVisible({ timeout: 30_000 });
  });

  test("cliente comum não acessa o admin", async ({ page }) => {
    await login(page);
    await page.goto("/admin");
    // O middleware manda para o login (sem sessão de admin).
    await expect(page).not.toHaveURL(/\/admin$/, { timeout: 30_000 });
  });

  // Regressão: no mobile o "Sair" só existia no rodapé da sidebar (hidden lg:flex),
  // então o admin não conseguia deslogar pelo celular. Agora o avatar abre um menu.
  test("logout pelo menu do avatar funciona no mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await login(page, DEMO_ADMIN);
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });

    await page.getByRole("button", { name: "Conta do administrador" }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();

    // Deslogado: /admin passa a redirecionar para o login.
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/, { timeout: 30_000 });
  });
});
