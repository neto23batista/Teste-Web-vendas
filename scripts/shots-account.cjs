// Loga como cliente e captura as telas da conta.
const { chromium } = require("playwright-core");
const fs = require("fs");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = "cliente@farmavida.local";
const PASS = "Cliente@2026";
const routes = [
  ["conta", "/conta"],
  ["conta-pedidos", "/conta/pedidos"],
  ["conta-fidelidade", "/conta/fidelidade"],
  ["conta-receitas", "/conta/receitas"],
  ["conta-perfil", "/conta/perfil"],
];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    colorScheme: "light",
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);

  for (const [name, path] of routes) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log("OK", name);
  }
  await browser.close();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
