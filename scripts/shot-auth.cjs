// QA visual temporário — telas autenticadas (admin e conta).
const { chromium } = require("playwright-core");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });

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
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log("OK ", name, "->", page.url());
  } catch (e) {
    console.log("ERR", name, e.message);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });

  // ── Admin ──
  let ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
  let page = await ctx.newPage();
  await login(page, "owner@farmavida.local", "Dono@Farma2026");
  await shot(page, "/admin/configuracoes", "auth-admin-configuracoes");
  await shot(page, "/admin/pedidos", "auth-admin-pedidos");
  const orderHref = await page.getAttribute('a[href^="/admin/pedidos/"]', "href").catch(() => null);
  if (orderHref) {
    await shot(page, orderHref, "auth-admin-pedido-detalhe");
    // Visão de impressão do recibo.
    await page.emulateMedia({ media: "print" });
    await page.screenshot({ path: `${OUT}/auth-admin-pedido-print.png`, fullPage: true });
    console.log("OK  auth-admin-pedido-print");
    await page.emulateMedia({ media: "screen" });
  }
  await shot(page, "/admin/receitas", "auth-admin-receitas");
  await shot(page, "/admin/receitas?status=APPROVED", "auth-admin-receitas-aprovadas");
  await ctx.close();

  // ── Cliente ──
  ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
  page = await ctx.newPage();
  await login(page, "cliente@farmavida.local", "Cliente@2026");
  await shot(page, "/conta/perfil", "auth-conta-perfil");
  // Adiciona um item para ver o checkout completo (com observações).
  await page.goto(`${BASE}/produto/dipirona-sodica-1g-10-comprimidos`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Adicionar à sacola")').catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, "/checkout", "auth-checkout");
  await ctx.close();

  await browser.close();
})();
