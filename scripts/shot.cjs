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
          await page.waitForTimeout(700);
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
