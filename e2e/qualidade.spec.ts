import { test, expect, type Page } from "@playwright/test";

/**
 * Guarda de qualidade: nenhuma página-chave pode emitir erro de console nem
 * exceção de página. Contra o BUILD DE PRODUÇÃO isso valida a CSP estrita por
 * nonce — uma violação aparece como "Refused to execute inline script…".
 */
const PAGES = ["/", "/catalogo", "/login", "/sobre", "/sacola"];

async function collectErrors(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

  await page.goto(path, { waitUntil: "networkidle" });
  // Dá tempo para hidratação/efeitos dispararem (e violarem a CSP, se for o caso).
  await page.waitForTimeout(1_500);
  return errors;
}

test.describe("Qualidade / CSP", () => {
  for (const path of PAGES) {
    test(`sem erros de console em ${path}`, async ({ page }) => {
      const errors = await collectErrors(page, path);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("página de produto sem erros de console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
    });
    page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

    await page.goto("/catalogo");
    const link = page.locator("article a[href^='/produto/']").first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    await link.click();
    await expect(page).toHaveURL(/\/produto\//, { timeout: 30_000 });
    await page.waitForTimeout(1_500);

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
