// Gera uma folha de contato (grade numerada) com as fotos de
// prisma/product-images.json para revisão visual de relevância.
// Uso: node scripts/contact-sheet.cjs  → screenshots/contact-sheet.png
const { chromium } = require("playwright-core");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const images = require(path.join(__dirname, "..", "prisma", "product-images.json"));

const cells = Object.entries(images)
  .map(
    ([name, url], i) => `
    <div class="cell">
      <img src="${url}" loading="eager" />
      <p><b>#${i + 1}</b> ${name}</p>
    </div>`
  )
  .join("");

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; margin: 12px; }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .cell { border: 1px solid #ccc; border-radius: 8px; padding: 6px; }
  .cell img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background:#eee; }
  .cell p { font-size: 11px; margin: 6px 0 0; line-height: 1.25; }
</style>
<div class="grid">${cells}</div>`;

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.setContent(html, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/contact-sheet.png", fullPage: true });
  console.log("OK screenshots/contact-sheet.png");
  await browser.close();
})();
