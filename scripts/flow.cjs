// Testa o fluxo de compra ponta a ponta e captura telas-chave.
const { chromium } = require("playwright-core");
const fs = require("fs");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = "cliente@farmavida.local";
const PASS = "Cliente@2026";
const PRODUCT = "/produto/dipirona-sodica-1g-10-comprimidos";

const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
const go = (p, url) => p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    colorScheme: "light",
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // 1) Login
  await go(page, BASE + "/login");
  await page.waitForTimeout(500);
  await shot(page, "flow-1-login");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page
    .waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  console.log("apos login, url =", page.url());

  // 2) Produto -> adicionar
  await go(page, BASE + PRODUCT);
  await page.getByRole("button", { name: /Adicionar à sacola/i }).click();
  await page.waitForTimeout(1800);

  // 3) Sacola
  await go(page, BASE + "/sacola");
  await page.waitForTimeout(600);
  await shot(page, "flow-2-sacola");

  // 4) Checkout
  await go(page, BASE + "/checkout");
  await page.waitForTimeout(800);
  await shot(page, "flow-3-checkout");

  // 5) Finalizar pedido -> pagina do pedido
  await page.getByRole("button", { name: /Finalizar pedido/i }).click();
  await page.waitForURL("**/pedido/**", { timeout: 25000 });
  await page.waitForTimeout(800);
  await shot(page, "flow-4-pedido-pendente");
  console.log("pedido criado, url =", page.url());

  // 6) Confirmar pagamento (simulado)
  const confirm = page.getByRole("button", { name: /Confirmar pagamento/i });
  if (await confirm.count()) {
    await confirm.click();
    await page.waitForTimeout(2500);
    await shot(page, "flow-5-pedido-pago");
    console.log("pagamento confirmado, status atualizado");
  } else {
    console.log("sem botao de confirmacao (talvez ja pago ou MP configurado)");
  }

  await browser.close();
})().catch((e) => {
  console.error("FLOW ERROR:", e.message);
  process.exit(1);
});
