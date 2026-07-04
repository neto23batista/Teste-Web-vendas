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
});
