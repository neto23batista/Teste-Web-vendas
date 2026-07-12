import { headers } from "next/headers";

/**
 * Rate limiting por janela fixa.
 *
 * - Com UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN definidos, usa o
 *   Upstash Redis via REST — durável e compartilhado entre as instâncias
 *   serverless (Vercel). É o modo recomendado em produção.
 * - Sem as variáveis (dev/VPS de instância única), cai no contador em memória.
 * - Se o Redis falhar/exceder o timeout, também cai no contador em memória
 *   (fail-open controlado: melhor limitar por instância do que derrubar login).
 */
export type RateResult = { ok: boolean; retryAfter: number };

// ───────────────────────── fallback em memória ─────────────────────────
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

// Limpeza preguiçosa para não vazar memória com chaves antigas.
function sweep(now: number) {
  if (store.size < 5000) return;
  for (const [k, b] of store) if (b.resetAt < now) store.delete(k);
}

function rateLimitMemory(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt < now) {
    sweep(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

// ───────────────────────── Upstash Redis (REST) ─────────────────────────
/**
 * As credenciais chegam com DOIS nomes possíveis, e aceitar só um faz o limite
 * durável cair no fallback em memória sem avisar:
 * - console do Upstash (colado à mão): UPSTASH_REDIS_REST_URL / _TOKEN
 * - integração do Marketplace da Vercel: KV_REST_API_URL / KV_REST_API_TOKEN
 */
function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** Há rate-limit durável (Redis) configurado? Usado pelo verificador de setup. */
export function rateLimitIsDurable(): boolean {
  return upstashEnv() !== null;
}

/**
 * INCR + PEXPIRE NX + PTTL num único pipeline (1 round-trip). O NX garante que
 * a janela só é criada no primeiro hit; os hits seguintes respeitam o TTL.
 * Retorna null em qualquer falha para o chamador usar o fallback local.
 */
async function rateLimitUpstash(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult | null> {
  const env = upstashEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", `rl:${key}`],
        ["PEXPIRE", `rl:${key}`, String(windowMs), "NX"],
        ["PTTL", `rl:${key}`],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data[0]?.result);
    if (!Number.isFinite(count)) return null;
    if (count > limit) {
      const ttl = Number(data[2]?.result);
      const ms = Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs;
      return { ok: false, retryAfter: Math.max(1, Math.ceil(ms / 1000)) };
    }
    return { ok: true, retryAfter: 0 };
  } catch {
    return null;
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  const durable = await rateLimitUpstash(key, limit, windowMs);
  return durable ?? rateLimitMemory(key, limit, windowMs);
}

/** IP do cliente a partir dos cabeçalhos do proxy. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
