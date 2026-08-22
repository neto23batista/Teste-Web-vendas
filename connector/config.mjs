// Configuração do conector: lê o .env desta pasta (nunca commitado).
// Segredos ficam SÓ na máquina da farmácia.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedInterval, normalizeServiceUrl } from "./security.mjs";

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

function integrationToken() {
  const token = required("FARMAVIDA_TOKEN");
  if (!/^fvi_[a-f0-9]{48}$/.test(token)) {
    console.error("[config] FARMAVIDA_TOKEN tem formato inválido; gere um novo token da unidade");
    process.exit(1);
  }
  return token;
}

export const config = {
  // API local da InovaFarma (executável inovafarma-api na máquina/rede da farmácia)
  inovafarmaUrl: normalizeServiceUrl(
    process.env.INOVAFARMA_URL || "http://localhost:9800",
    { label: "INOVAFARMA_URL", localService: true }
  ),
  clientId: required("INOVAFARMA_CLIENT_ID"),
  clientSecret: required("INOVAFARMA_CLIENT_SECRET"),
  lojaId: required("INOVAFARMA_LOJA_ID"),
  // FarmaVida na nuvem + token da unidade (gerado em /admin/integracao)
  farmavidaUrl: normalizeServiceUrl(
    process.env.FARMAVIDA_URL || "http://localhost:3000",
    { label: "FARMAVIDA_URL" }
  ),
  farmavidaToken: integrationToken(),
  // Cadências (minutos/segundos)
  catalogEveryMin: boundedInterval(process.env.SYNC_CATALOGO_MIN, {
    fallback: 5,
    min: 1,
    max: 1440,
    label: "SYNC_CATALOGO_MIN",
  }),
  ordersEverySec: boundedInterval(process.env.POLL_PEDIDOS_SEG, {
    fallback: 30,
    min: 5,
    max: 3600,
    label: "POLL_PEDIDOS_SEG",
  }),
};
