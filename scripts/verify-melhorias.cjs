// Verificação E2E das melhorias: moderação de reviews, favoritos por conta,
// LGPD (export/exclusão) e PWA (manifest + service worker).
// Uso: BASE=http://localhost:3001 node scripts/verify-melhorias.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.BASE || "http://localhost:3001";
const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, extra = "") =>
  results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });

  // ── 1. PWA: manifest + service worker ─────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    const mfRes = await page.goto(`${BASE}/manifest.webmanifest`);
    const mf = await mfRes.json().catch(() => null);
    check(
      "Manifest com ícones PNG + tema vermelho",
      !!mf &&
        mf.theme_color === "#ea1d2c" &&
        mf.icons.some((i) => i.src === "/icon-512.png") &&
        mf.icons.some((i) => i.purpose === "maskable")
    );
    await page.goto(BASE, { waitUntil: "networkidle" });
    const swActive = await page
      .evaluate(async () => {
        if (!("serviceWorker" in navigator)) return false;
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((r) => setTimeout(() => r(null), 8000)),
        ]);
        return !!(reg && reg.active);
      })
      .catch(() => false);
    check("Service worker registrado e ativo", swActive);
    await ctx.close();
  }

  // ── 2. Cliente: avaliação pendente + favorito + export ────────
  const PRODUCT = "/produto/dipirona-sodica-1g-10-comprimidos";
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, "cliente@farmavida.local", "Cliente@2026");

    // Envia avaliação (4 estrelas) — tudo escopado ao form de review
    // (a página tem outros forms, ex.: busca no header).
    await page.goto(BASE + PRODUCT, { waitUntil: "networkidle" });
    const reviewForm = page.locator('form:has(textarea[name="comment"])');
    await reviewForm.getByRole("button", { name: "4 estrelas" }).click();
    await reviewForm.locator("textarea").fill("Teste de moderação automática.");
    const t0 = Date.now();
    await reviewForm.locator('button[type="submit"]').click();
    const successMsg = await reviewForm
      .getByText(/após a aprovação/i)
      .waitFor({ timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    await page.screenshot({ path: `${OUT}/v-review-submit.png` });
    check(
      "Avaliação enviada com aviso de moderação",
      successMsg,
      `${((Date.now() - t0) / 1000).toFixed(1)}s`
    );

    // Não deve aparecer publicamente ainda — o card público envolve o
    // comentário em aspas tipográficas (o texto sem aspas existe no form).
    await page.reload({ waitUntil: "networkidle" });
    const visible = await page
      .getByText("“Teste de moderação automática.”")
      .isVisible()
      .catch(() => false);
    check("Avaliação NÃO aparece antes de aprovar", !visible);

    // Favorita ESTE produto (botão com rótulo da página de detalhe)
    await page.getByRole("button", { name: /Salvar nos favoritos/i }).click();
    await page.waitForTimeout(1500); // action best-effort no servidor
    await page.goto(`${BASE}/conta/favoritos`, { waitUntil: "networkidle" });
    const favShown = await page
      .getByText(/Dipirona/i)
      .first()
      .waitFor({ timeout: 12000 }) // sync (merge) + fetch by-ids + render
      .then(() => true)
      .catch(() => false);
    check("Favorito aparece em Minha conta (sincronizado)", favShown);
    await page.screenshot({ path: `${OUT}/v-conta-favoritos.png`, fullPage: true });

    // Export LGPD
    const exp = await page.request.get(`${BASE}/api/account/export`);
    const body = await exp.json().catch(() => null);
    check(
      "Export LGPD devolve JSON completo",
      exp.status() === 200 && !!body?.perfil?.email && Array.isArray(body?.pedidos)
    );

    await page.goto(`${BASE}/conta/privacidade`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}/v-conta-privacidade.png`, fullPage: true });
    await ctx.close();
  }

  // ── 3. Admin: badge + aprovar avaliação ───────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, "owner@farmavida.local", "Dono@Farma2026");

    await page.goto(`${BASE}/admin/avaliacoes`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}/v-admin-avaliacoes.png`, fullPage: true });
    const pendingShown = await page
      .getByText("Teste de moderação automática.")
      .isVisible()
      .catch(() => false);
    check("Avaliação pendente listada no admin", pendingShown);

    await page.getByRole("button", { name: /Aprovar/i }).first().click();
    await page.waitForTimeout(2500);

    await page.goto(BASE + PRODUCT, { waitUntil: "networkidle" });
    const nowVisible = await page
      .getByText("“Teste de moderação automática.”")
      .isVisible()
      .catch(() => false);
    check("Avaliação aparece na loja após aprovar", nowVisible);

    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/v-admin-dashboard.png`, fullPage: true });
    await ctx.close();
  }

  // ── 4. LGPD: criar conta de teste e excluir ───────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    const email = `lgpd-teste-${Date.now()}@exemplo.com`;
    const pass = "Lgpd@Teste2026";

    await page.goto(`${BASE}/cadastro`, { waitUntil: "networkidle" });
    await page.fill('input[name="name"]', "Teste LGPD");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', pass);
    await page.fill('input[name="confirm"]', pass);
    await page.check('input[name="lgpd"]');
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/cadastro"), { timeout: 20000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.goto(`${BASE}/conta/privacidade`, { waitUntil: "networkidle" });
    await page.fill('input[name="confirmEmail"]', email);
    await page.getByRole("button", { name: /Excluir minha conta/i }).click();
    await page.waitForTimeout(3500);

    // Tentar logar de novo: deve falhar
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', pass);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    const stillOnLogin = page.url().includes("/login");
    check("Conta excluída não loga mais", stillOnLogin);
    await ctx.close();
  }

  await browser.close();
  console.log("\n══════ RESULTADO ══════");
  for (const r of results) console.log(r);
  const fails = results.filter((r) => r.startsWith("❌")).length;
  console.log(`\n${results.length - fails}/${results.length} checks OK`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.log("\n══════ RESULTADO (parcial — erro no meio) ══════");
  for (const r of results) console.log(r);
  console.error("ERRO:", e.message.split("\n")[0]);
  process.exit(1);
});
