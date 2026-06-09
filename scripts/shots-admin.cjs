// Loga como admin e captura as telas do painel.
const { chromium } = require("playwright-core");
const fs = require("fs");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = process.env.FV_ADMIN_EMAIL || "owner@farmavida.local";
const PASS = process.env.FV_ADMIN_PASS || "Dono@Farma2026";
const routes = [
  ["admin-dashboard", "/admin"],
  ["admin-pedidos", "/admin/pedidos"],
  ["admin-produtos", "/admin/produtos"],
  ["admin-estoque", "/admin/estoque"],
  ["admin-produto-novo", "/admin/produtos/novo"],
  ["admin-cupons", "/admin/cupons"],
  ["admin-cupom-novo", "/admin/cupons/novo"],
];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  console.log("apos login admin, url =", page.url());

  for (const [name, path] of routes) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log("OK", name);
  }
  await browser.close();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
