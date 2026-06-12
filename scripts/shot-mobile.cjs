// QA mobile — telas autenticadas em viewport de celular (390x844).
const { chromium } = require("playwright-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://localhost:3000";

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function shot(page, route, name) {
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `screenshots/m-${name}.png`, fullPage: true });
    console.log("OK ", name);
  } catch (e) {
    console.log("ERR", name, e.message);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let page = await ctx.newPage();
  await login(page, "owner@farmavida.local", "Dono@Farma2026");
  await shot(page, "/admin", "admin-dashboard");
  await shot(page, "/admin/pedidos", "admin-pedidos");
  const orderHref = await page.getAttribute('a[href^="/admin/pedidos/"]', "href").catch(() => null);
  if (orderHref) await shot(page, orderHref, "admin-pedido-detalhe");
  await shot(page, "/admin/produtos", "admin-produtos");
  await shot(page, "/admin/estoque", "admin-estoque");
  await shot(page, "/admin/clientes", "admin-clientes");
  await shot(page, "/admin/cupons", "admin-cupons");
  await shot(page, "/admin/configuracoes", "admin-configuracoes");
  await ctx.close();

  const ctx2 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  page = await ctx2.newPage();
  await login(page, "cliente@farmavida.local", "Cliente@2026");
  await shot(page, "/sacola", "sacola");
  await shot(page, "/checkout", "checkout");
  await shot(page, "/conta", "conta");
  await shot(page, "/conta/pedidos", "conta-pedidos");
  await ctx2.close();

  await browser.close();
})();
