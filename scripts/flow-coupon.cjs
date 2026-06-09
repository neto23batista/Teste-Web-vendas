// Cria um cupom pelo admin e valida que aparece na listagem.
const { chromium } = require("playwright-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = "owner@farmavida.local";
const PASS = "Dono@Farma2026";

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  const page = await browser.newContext().then((c) => c.newPage());

  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 }).catch(() => {});

  await page.goto(BASE + "/admin/cupons/novo", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="code"]', "TESTE15");
  await page.selectOption('select[name="type"]', "FIXED");
  await page.fill('input[name="value"]', "15");
  await page.fill('input[name="minTotal"]', "80");
  await page.getByRole("button", { name: /Criar cupom/i }).click();
  await page.waitForURL("**/admin/cupons", { timeout: 20000 });
  await page.waitForTimeout(600);

  const text = await page.textContent("body");
  console.log("TESTE15 na lista:", text.includes("TESTE15"));
  console.log("R$ 15 exibido:", text.includes("15,00"));
  await browser.close();
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
