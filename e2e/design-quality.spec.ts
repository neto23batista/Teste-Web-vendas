import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ALLOW_WRITES, DEMO_ADMIN, login } from "./helpers";

const sizes = [{ name: "mobile", width: 375, height: 812 }, { name: "landscape", width: 844, height: 390 }, { name: "tablet", width: 768, height: 1024 }, { name: "desktop", width: 1440, height: 1000 }];
for (const size of sizes) {
  test(`design: home ${size.name}, claro/escuro e contraste`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    for (const theme of ["light", "dark"]) {
      if (theme === "dark") await page.getByRole("button", { name: "Alternar tema claro/escuro" }).filter({ visible: true }).first().click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
      await page.screenshot({ path: `screenshots/design/home-${size.name}-${theme}.png` });
    }
    expect(errors).toEqual([]);
  });
}

test("design: texto ampliado, cores forçadas e conteúdo sem JS", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/catalogo");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, offenders: Array.from(document.querySelectorAll("body *")).filter((el) => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((el) => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right })) }));
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width + 1);
  const search = page.getByRole("combobox", { name: "Buscar produtos" }).filter({ visible: true }).first();
  await search.focus();
  expect(await search.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe("none");
  await page.screenshot({ path: "screenshots/design/catalogo-high-contrast-200.png" });
});

test("design: checkout preserva rascunho, reabre erro, confirma cores e teclado", async ({ page }) => {
  test.skip(!ALLOW_WRITES, "exige banco descartável");
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto("/catalogo");
  await page.locator("article").filter({ hasNotText: "Sem estoque" }).first().getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Adicionado à sacola")).toBeVisible();
  await page.goto("/checkout");
  await page.getByRole("radio", { name: /Usar um novo endereço/ }).check();
  await page.getByLabel("Destinatário", { exact: true }).fill("Cliente de teste");
  await page.getByRole("button", { name: /Endereço de entrega/ }).click();
  await page.getByRole("button", { name: /Endereço de entrega/ }).click();
  await expect(page.getByLabel("Destinatário", { exact: true })).toHaveValue("Cliente de teste");
  await page.getByRole("button", { name: "Continuar para entrega" }).click();
  await expect(page.getByLabel("CEP", { exact: true })).toBeFocused();
  await page.getByRole("radio").filter({ visible: true }).first().check();
  await page.getByRole("button", { name: "Continuar para entrega" }).click();
  await expect(page.getByRole("button", { name: /Como quer receber/ })).toBeFocused();
  await page.getByRole("button", { name: "Continuar para pagamento" }).click();
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  await expect(page.getByRole("heading", { name: /Revisão do pedido/ })).toBeFocused();
  await expect(page.getByRole("button", { name: "Finalizar pedido" })).toBeEnabled();
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await page.getByRole("button", { name: "Alternar tema claro/escuro" }).filter({ visible: true }).first().click();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `screenshots/design/checkout-${theme}.png` });
  }
  await page.getByRole("button", { name: "Finalizar pedido" }).scrollIntoViewIfNeeded();
  const finish = await page.getByRole("button", { name: "Finalizar pedido" }).boundingBox();
  const nav = await page.getByRole("navigation", { name: "Navegação", exact: true }).boundingBox();
  expect(finish!.y + finish!.height).toBeLessThan(nav!.y);
  await page.screenshot({ path: "screenshots/design/checkout-confirmacao-mobile.png" });
});

test("design: painel com tabelas acessíveis e confirmação contextual", async ({ page }) => {
  await login(page, DEMO_ADMIN);
  await page.goto("/admin");
  const tableToggle = page.getByText("Ver dados em tabela", { exact: true }).first();
  if (await tableToggle.count()) {
    await tableToggle.click();
    await expect(page.getByRole("table").first()).toBeVisible();
  } else {
    await expect(page.getByText("Sem dados de vendas no período selecionado.")).toBeVisible();
  }
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "screenshots/design/admin-desktop.png" });
});

test.describe("design: HTML sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("produtos e categorias permanecem visíveis", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("article").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/catalogo");
    await expect(page.locator("article").first()).toBeVisible();
    await page.locator("article").first().getByRole("link").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test("design: fotografia indisponível tem recuperação e descrição acessível", async ({ page }) => {
  await page.route("**/api/search?*", (route) => route.fulfill({ json: { items: [{ name: "Produto com foto indisponível", slug: "produto-qa", emoji: "💊", image: "/products/qa-missing.webp", price: 10, oldPrice: null, category: "Teste" }] } }));
  await page.route("**/_next/image?*", (route) => route.abort());
  await page.goto("/catalogo");
  await page.getByRole("combobox", { name: "Buscar produtos" }).filter({ visible: true }).first().fill("produto");
  await expect(page.getByRole("img", { name: "Produto com foto indisponível: imagem indisponível" })).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Sugestões de produtos" }).getByRole("option")).not.toContainText("💊");
});

test("design: ação destrutiva distingue risco sem depender só da cor", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, DEMO_ADMIN);
  await page.goto("/admin/estoque");
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await page.getByRole("button", { name: "Alternar tema claro/escuro" }).click();
    await page.getByRole("button", { name: "Remover 1", exact: true }).first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.locator("svg.lucide-triangle-alert").first()).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    await page.screenshot({ path: `screenshots/design/confirmacao-destrutiva-${theme}.png` });
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  }
});
