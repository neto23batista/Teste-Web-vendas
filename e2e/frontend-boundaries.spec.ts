import { test, expect } from "@playwright/test";
import { ALLOW_WRITES, DEMO_ADMIN, login } from "./helpers";

test.describe("Fronteiras e recuperação do front-end", () => {
  test("busca descarta resposta antiga em rede lenta", async ({ page }) => {
    await page.route("**/api/search?*", async (route) => {
      const term = new URL(route.request().url()).searchParams.get("q");
      await new Promise((resolve) => setTimeout(resolve, term === "primeiro" ? 1200 : 50));
      await route.fulfill({ json: { items: [{ name: `Resultado ${term}`, slug: "produto-qa", emoji: null, image: null, price: 10, oldPrice: null, category: "Teste" }] } }).catch(() => {});
    });
    await page.goto("/catalogo");
    const search = page.getByRole("combobox", { name: "Buscar produtos" }).filter({ visible: true }).first();
    await search.fill("primeiro");
    await page.waitForRequest((request) => request.url().includes("/api/search?q=primeiro"));
    await search.fill("segundo");
    await expect(page.getByRole("option", { name: /Resultado segundo/ })).toBeVisible();
    await page.waitForTimeout(1400);
    await expect(page.getByRole("option", { name: /Resultado primeiro/ })).toHaveCount(0);
    await expect(search).toHaveAttribute("aria-busy", "false");
  });

  test("confirmar estoque exige motivo, prende foco e restaura ao cancelar em mobile", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, DEMO_ADMIN);
    await page.goto("/admin/estoque");
    const trigger = page.getByRole("button", { name: "Adicionar 1", exact: true }).first();
    await trigger.click();
    const dialog = page.getByRole("alertdialog", { name: "Registrar entrada manual" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("confirmacao-claro-mobile.png") });
    let mutations = 0;
    page.on("request", (request) => { if (request.method() === "POST") mutations += 1; });
    await dialog.getByRole("button", { name: "Confirmar ajuste de estoque" }).click();
    const reason = dialog.getByRole("textbox", { name: /Motivo do ajuste/ });
    await expect(reason).toBeFocused();
    expect(await reason.evaluate((node: HTMLTextAreaElement) => node.validity.valueMissing)).toBe(true);
    expect(mutations).toBe(0);
    const bounds = await dialog.boundingBox();
    expect(bounds?.width).toBeLessThanOrEqual(390);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.getByRole("button", { name: "Alternar tema claro/escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("confirmacao-escuro-mobile.png") });
    const contrast = await dialog.evaluate((element) => {
      const luminance = (color: string) => {
        const channels = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const foreground = luminance(getComputedStyle(element.querySelector("h2")!).color);
      const background = luminance(getComputedStyle(element).backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  test("checkout mobile aguarda cotação autoritativa e permite recuperar erro de cupom", async ({ page }, testInfo) => {
    test.skip(!ALLOW_WRITES, "usa apenas o banco descartável explicitamente configurado");
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/catalogo");
    const card = page.locator("article").filter({ hasNotText: "Receita" }).filter({ hasNotText: "Sem estoque" }).first();
    await card.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText("Adicionado à sacola")).toBeVisible();
    await page.route("**/checkout", async (route) => {
      if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto("/checkout");
    const finish = page.getByRole("button", { name: "Finalizar pedido" });
    await expect(finish).toBeDisabled();
    await expect(finish).toBeEnabled({ timeout: 30_000 });
    await page.getByLabel("Cupom de desconto").fill("QA-CUPOM-INEXISTENTE");
    await expect(finish).toBeDisabled();
    await expect(page.getByRole("alert").filter({ hasText: /cupom/i })).toBeVisible();
    await page.getByLabel("Cupom de desconto").fill("");
    await expect(finish).toBeEnabled({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("checkout-mobile.png"), fullPage: true });
    // No order is submitted in this test; the purchase spec covers confirmation.
  });
});

test.describe("HTML progressivo", () => {
  test.use({ javaScriptEnabled: false });
  test("busca funciona sem JavaScript", async ({ page }) => {
    await page.goto("/catalogo");
    const search = page.getByRole("combobox", { name: "Buscar produtos" }).filter({ visible: true }).first();
    await search.fill("vitamina");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/catalogo\?q=vitamina/);
    await expect(page.locator("main")).toBeVisible();
  });
});
