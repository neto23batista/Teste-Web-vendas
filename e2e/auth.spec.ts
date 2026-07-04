import { test, expect } from "@playwright/test";
import { login, ALLOW_WRITES } from "./helpers";

test.describe("Autenticação e conta", () => {
  test("login leva à conta e mostra a visão geral", async ({ page }) => {
    await login(page);

    await page.goto("/conta");
    await expect(page.getByText("Pedidos realizados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Assinaturas" })).toBeVisible();
  });

  test("edição de perfil salva com sucesso", async ({ page }) => {
    test.skip(!ALLOW_WRITES, "escreve no banco — rode com E2E_ALLOW_WRITES=1");
    await login(page);

    await page.goto("/conta/perfil");
    await expect(page.locator("#name")).toBeVisible();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Dados atualizados com sucesso!")).toBeVisible({
      timeout: 30_000,
    });
  });
});
