import { headers } from "next/headers";

/**
 * Rate limiting simples por janela fixa, EM MEMÓRIA.
 * Suficiente para uma única instância (VPS/Docker). Para Vercel/multi-instância,
 * troque a implementação por Upstash Redis mantendo a mesma assinatura.
 */
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

// Limpeza preguiçosa para não vazar memória com chaves antigas.
function sweep(now: number) {
  if (store.size < 5000) return;
  for (const [k, b] of store) if (b.resetAt < now) store.delete(k);
}

export type RateResult = { ok: boolean; retryAfter: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateResult {
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

/** IP do cliente a partir dos cabeçalhos do proxy. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
