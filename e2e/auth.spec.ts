import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Autenticação e conta", () => {
  test("login e edição de perfil", async ({ page }) => {
    await login(page);

    // Acessa a conta e salva o perfil — deve exibir a mensagem de sucesso.
    await page.goto("/conta/perfil");
    await expect(page.locator("#name")).toBeVisible();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Dados atualizados com sucesso!")).toBeVisible({
      timeout: 30_000,
    });
  });
});
