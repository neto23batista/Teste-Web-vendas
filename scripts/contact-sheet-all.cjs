// Folha de contato de TODAS as candidatas únicas (numeradas) para escolher
// manualmente a foto certa de cada produto.
// Uso: node scripts/contact-sheet-all.cjs → screenshots/contact-sheet-all.png
//      (também imprime o índice → URL no console)
const { chromium } = require("playwright-core");
const { candidates } = require("./check-product-images.cjs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const unique = [...new Set(Object.values(candidates).flat())];

// Divide em partes (células grandes = revisão confiável).
const PER_SHEET = 15;
const parts = [];
for (let i = 0; i < unique.length; i += PER_SHEET) {
  parts.push(unique.slice(i, i + PER_SHEET));
}

const htmlFor = (urls, offset) => `<!doctype html><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; margin: 10px; }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .cell { border: 1px solid #ccc; border-radius: 6px; padding: 5px; }
  .cell img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; background:#eee; }
  .cell p { font-size: 16px; margin: 5px 0 0; text-align: center; font-weight: bold; }
</style>
<div class="grid">${urls
  .map(
    (url, i) => `
  <div class="cell"><img src="${url}" loading="eager" /><p>#${offset + i + 1}</p></div>`
  )
  .join("")}</div>`;

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  for (let p = 0; p < parts.length; p++) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    await page.setContent(htmlFor(parts[p], p * PER_SHEET), {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `screenshots/contact-sheet-all-${p + 1}.png`,
      fullPage: true,
    });
    console.log(`OK screenshots/contact-sheet-all-${p + 1}.png`);
    await page.close();
  }
  await browser.close();
})();
