// Configuração do conector: lê o .env desta pasta (nunca commitado).
// Segredos ficam SÓ na máquina da farmácia.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(dir, ".env");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[config] variável obrigatória ausente: ${name} (veja .env.example)`);
    process.exit(1);
  }
  return v;
}

export const config = {
  // API local da InovaFarma (executável inovafarma-api na máquina/rede da farmácia)
  inovafarmaUrl: (process.env.INOVAFARMA_URL || "http://localhost:9800").replace(/\/$/, ""),
  clientId: required("INOVAFARMA_CLIENT_ID"),
  clientSecret: required("INOVAFARMA_CLIENT_SECRET"),
  lojaId: required("INOVAFARMA_LOJA_ID"),
  // FarmaVida na nuvem + token da unidade (gerado em /admin/integracao)
  farmavidaUrl: (process.env.FARMAVIDA_URL || "http://localhost:3000").replace(/\/$/, ""),
  farmavidaToken: required("FARMAVIDA_TOKEN"),
  // Cadências (minutos/segundos)
  catalogEveryMin: Number(process.env.SYNC_CATALOGO_MIN) || 5,
  ordersEverySec: Number(process.env.POLL_PEDIDOS_SEG) || 30,
};
