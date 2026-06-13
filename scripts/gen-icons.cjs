// Gera os ícones PNG do PWA a partir de public/icon.svg (via Edge headless).
// Uso: node scripts/gen-icons.cjs
//  → public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const svg = fs.readFileSync(path.join(__dirname, "..", "public", "icon.svg"), "utf8");

// Maskable: o conteúdo precisa caber na "safe zone" (círculo de 80%) — então o
// ícone é desenhado com folga sobre o fundo da marca.
const pages = [
  { out: "icon-192.png", size: 192, html: `<body style="margin:0">${svg.replace(/width="512" height="512"/, 'width="192" height="192"')}</body>` },
  { out: "icon-512.png", size: 512, html: `<body style="margin:0">${svg}</body>` },
  {
    out: "icon-maskable-512.png",
    size: 512,
    html: `<body style="margin:0;display:grid;place-items:center;width:512px;height:512px;background:#ea1d2c">
      <div style="width:360px;height:360px">${svg.replace(/width="512" height="512"/, 'width="360" height="360"')}</div>
    </body>`,
  },
];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  for (const p of pages) {
    const page = await browser.newPage({
      viewport: { width: p.size, height: p.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(p.html, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(__dirname, "..", "public", p.out),
      omitBackground: false,
    });
    console.log("OK public/" + p.out);
    await page.close();
  }
  await browser.close();
})();
