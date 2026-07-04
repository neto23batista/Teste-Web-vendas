import { test, expect } from "@playwright/test";

// Fluxos SOMENTE LEITURA da loja — seguros contra qualquer banco.
test.describe("Vitrine", () => {
  test("home renderiza hero, lanes de produto e carrossel", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /Saúde e bem-estar/ })
    ).toBeVisible();

    // Lanes com cards de produto (carrossel).
    await expect(page.locator("article").first()).toBeVisible({
      timeout: 30_000,
    });
    expect(await page.locator("article").count()).toBeGreaterThanOrEqual(4);
  });

  test("busca com autocomplete sugere produtos", async ({ page }) => {
    await page.goto("/catalogo");

    const box = page.getByRole("combobox", { name: "Buscar produtos" });
    await expect(box).toBeVisible();
    await box.fill("vita");

    // Dropdown de sugestões (debounce + /api/search).
    await expect(page.locator("#search-suggestions")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("página de produto mostra preço, compra e assinatura", async ({
    page,
  }) => {
    await page.goto("/catalogo");
    const card = page
      .locator("article")
      .filter({ hasNotText: "Receita" })
      .first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByRole("link").first().click();

    await expect(page).toHaveURL(/\/produto\//, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // filter visible: a sticky bar do mobile também tem preços (ocultos no desktop).
    await expect(
      page.getByText("R$").filter({ visible: true }).first()
    ).toBeVisible();
    // Bloco de assinatura (produto sem receita).
    await expect(
      page.getByText("Assine a reposição e nunca fique sem")
    ).toBeVisible();
  });

  test("sacola e páginas institucionais respondem", async ({ page }) => {
    for (const path of ["/sacola", "/sobre", "/catalogo?promo=1"]) {
      const res = await page.goto(path);
      expect(res?.status(), `status de ${path}`).toBeLessThan(400);
    }
  });
});
