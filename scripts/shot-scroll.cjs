// QA visual com SCROLL progressivo — dispara as animações whileInView antes
// do screenshot (o shot.cjs captura a página sem rolar, então seções abaixo
// do fold ficam invisíveis). Uso:
//   BASE=http://localhost:3001 node scripts/shot-scroll.cjs / /catalogo ...
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
        } catch {}
      }, theme);
      const page = await ctx.newPage();
      for (const route of routes) {
        const name = `r-${slug(route)}-${vp.tag}-${theme}`;
        try {
          await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
          // Rola até o fim em passos para disparar whileInView, depois volta.
          await page.evaluate(async () => {
            const step = window.innerHeight * 0.7;
            for (let y = 0; y < document.body.scrollHeight; y += step) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 180));
            }
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise((r) => setTimeout(r, 400));
            window.scrollTo(0, 0);
          });
          await page.waitForTimeout(900);
          await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
          console.log("OK ", name);
        } catch (e) {
          console.log("ERR", name, e.message.split("\n")[0]);
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
})();
