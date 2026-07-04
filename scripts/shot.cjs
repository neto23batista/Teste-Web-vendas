// QA visual — captura telas em desktop/mobile e claro/escuro usando o Edge.
// Uso: node scripts/shot.cjs [rota1 rota2 ...]   (default: "/")
const { chromium } = require("playwright-core");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.BASE || "http://localhost:3000";
const OUT = "screenshots";
fs.mkdirSync(OUT, { recursive: true });

const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["/"];
const viewports = [
  { tag: "desktop", width: 1366, height: 900 },
  { tag: "mobile", width: 390, height: 844 },
];
const themes = ["light", "dark"];

const slug = (r) => (r === "/" ? "home" : r.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, ""));

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  for (const theme of themes) {
    for (const vp of viewports) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
        deviceScaleFactor: 2,
      });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t);
        } catch (e) {}
      }, theme);
      const page = await ctx.newPage();
      for (const route of routes) {
        const name = `${slug(route)}-${vp.tag}-${theme}`;
        try {
          await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
          // Espera a HIDRATAÇÃO de verdade (não um sleep fixo): o h1 do hero
          // só chega a opacity 1 quando o framer-motion animou — antes disso o
          // fullPage sai com as seções invisíveis. Páginas sem h1 animado
          // seguem após o timeout curto.
          await page
            .waitForFunction(
              () => {
                const h1 = document.querySelector("h1");
                return h1 && getComputedStyle(h1).opacity === "1";
              },
              { timeout: 15000 }
            )
            .catch(() => {});
          await page.waitForTimeout(500);
          // Rola a página inteira para disparar as animações de entrada
          // (whileInView) antes do screenshot — senão as seções abaixo da
          // dobra saem invisíveis (opacity 0) no fullPage.
          await page.evaluate(async () => {
            // "instant" fura o scroll-behavior:smooth do html — com smooth, os
            // saltos rápidos nunca "param" nas seções e o IntersectionObserver
            // do whileInView pode não disparar.
            const step = window.innerHeight * 0.8;
            for (let y = 0; y < document.body.scrollHeight; y += step) {
              window.scrollTo({ top: y, behavior: "instant" });
              await new Promise((r) => setTimeout(r, 220));
            }
            window.scrollTo({ top: 0, behavior: "instant" });
          });
          await page.waitForTimeout(900);
          await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
          console.log("OK ", name);
        } catch (e) {
          console.log("ERR", name, e.message);
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
})();
