// Cliente HTTP da Web API local da InovaFarma (inovafarma-api).
// Autentica com Client ID/Secret (Portal PS) e faz GET/POST com timeout e
// re-tentativa exponencial. CONTRATOS ASSUMIDOS — ajustar na homologação
// (Fase 6) quando a documentação oficial da Precisão chegar.

import { config } from "./config.mjs";

let cachedToken = null;
let tokenExpiresAt = 0;

async function fetchWithTimeout(url, options = {}, timeoutMs = 15_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Token OAuth-like da API local (contrato assumido: POST /auth/token). */
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken;

  const res = await fetchWithTimeout(`${config.inovafarmaUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      loja_id: config.lojaId,
    }),
  });
  if (!res.ok) {
    throw new Error(`auth falhou: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("auth sem access_token na resposta");
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return cachedToken;
}

/** Requisição autenticada à API local, com até 3 tentativas (backoff 1s/4s). */
export async function inovafarma(method, path, body) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt === 1 ? 1000 : 4000));
    }
    try {
      const token = await getToken();
      const res = await fetchWithTimeout(`${config.inovafarmaUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) {
        cachedToken = null; // token expirou no meio — renova e tenta de novo
        throw new Error("401 da API local (token renovado para retry)");
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** Requisição autenticada ao FarmaVida (nuvem), com o token da unidade. */
export async function farmavida(method, path, body) {
  const res = await fetchWithTimeout(
    `${config.farmavidaUrl}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${config.farmavidaToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    30_000
  );
  if (!res.ok) {
    throw new Error(
      `FarmaVida ${path}: HTTP ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  return res.json();
}

/** Ping simples nas duas pontas (Fase 1 do guia). */
export async function pingAll() {
  await getToken();
  console.log("[ping] inovafarma-api OK");
  await farmavida("GET", "/api/integracao/pedidos");
  console.log("[ping] FarmaVida OK");
}
