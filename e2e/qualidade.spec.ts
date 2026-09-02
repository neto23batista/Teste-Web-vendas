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
  test("envia cabeçalhos defensivos na navegação", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    const csp = response.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    // Chunks externos do App Router podem ser emitidos sem nonce. Eles devem
    // continuar restritos à própria origem, sem strict-dynamic descartar self.
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("'strict-dynamic'");
  });

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

test.describe("Acessibilidade e layout móvel", () => {
  test("atalho de teclado leva ao conteúdo principal", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Pular para o conteúdo principal" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page.locator("#conteudo-principal")).toBeFocused();
  });

  for (const path of ["/", "/catalogo", "/login"]) {
    test(`sem rolagem horizontal em 360px: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(path, { waitUntil: "networkidle" });
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
    });
  }
});
