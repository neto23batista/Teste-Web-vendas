import { headers } from "next/headers";
import Redis from "ioredis";

/**
 * Rate limiting por janela fixa. Contador DURÁVEL (compartilhado entre as
 * instâncias serverless da Vercel) por dois caminhos, nesta ordem:
 *
 * 1. REST (Upstash): UPSTASH_REDIS_REST_URL + _TOKEN (ou KV_REST_API_*).
 * 2. TCP: REDIS_URL — é o que a integração "Redis" do Marketplace da Vercel
 *    injeta (só TCP, sem REST). Só é seguro usar porque `rateLimit` roda apenas
 *    em Server Actions e rotas de API (runtime Node) — nunca no middleware/edge,
 *    onde socket TCP não existe.
 * 3. Sem nenhuma das duas (dev/VPS), cai no contador em memória.
 *
 * Se o Redis falhar/exceder o timeout, também cai em memória (fail-open
 * controlado: melhor limitar por instância do que derrubar o login da loja).
 */
export type RateResult = { ok: boolean; retryAfter: number };

/**
 * Traduz o par (contador, TTL) que o Redis devolve em RateResult. Compartilhado
 * pelos dois caminhos (REST e TCP) para o cálculo do retryAfter não divergir
 * entre eles. `null` = resposta inesperada → o chamador cai no contador local.
 */
function windowResult(
  rawCount: unknown,
  rawTtl: unknown,
  limit: number,
  windowMs: number
): RateResult | null {
  const count = Number(rawCount);
  if (!Number.isFinite(count)) return null;
  if (count <= limit) return { ok: true, retryAfter: 0 };
  const ttl = Number(rawTtl);
  const ms = Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs;
  return { ok: false, retryAfter: Math.max(1, Math.ceil(ms / 1000)) };
}

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

// ───────────────────────── Redis via TCP (REDIS_URL) ─────────────────────────
/**
 * INCR + PEXPIRE (só no 1º hit) + PTTL de forma ATÔMICA. Em Lua para valer em
 * qualquer versão do Redis — `PEXPIRE ... NX` só existe do Redis 7 em diante.
 */
const WINDOW_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { c, redis.call('PTTL', KEYS[1]) }
`;

// Singleton: a instância serverless é reaproveitada entre requisições quentes,
// então a conexão TCP é aberta uma vez, não a cada login.
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    redisClient = null;
    return null;
  }
  // O construtor do ioredis faz `new URL(url)` de forma SÍNCRONA e LANÇA em uma
  // URL malformada (ex.: colada com espaço no painel). Fora de um try/catch isso
  // subiria por todo `rateLimit` e derrubaria login/checkout do site — o oposto
  // do fail-open prometido. Em erro, marca como indisponível e cai em memória.
  try {
    redisClient = new Redis(url, {
      connectTimeout: 2000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      // Com fila offline: o 1º comando (conexão preguiçosa ainda abrindo) espera a
      // conexão em vez de ser rejeitado na hora — senão o 1º hit de cada instância
      // nova furava o Redis e caía no contador em memória. Se o Redis estiver fora,
      // o commandTimeout (2s) encerra a espera e o chamador cai em memória.
      enableOfflineQueue: true,
      lazyConnect: true,
    });
  } catch (err) {
    console.error(
      "[rate-limit] REDIS_URL inválida, usando contador em memória:",
      err instanceof Error ? err.message : err
    );
    redisClient = null;
    return null;
  }
  // Sem listener de 'error' o ioredis derruba o processo com unhandled error.
  redisClient.on("error", (err: Error) => {
    console.error("[rate-limit] redis:", err.message);
  });
  return redisClient;
}

async function rateLimitRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const res = (await redis.eval(
      WINDOW_SCRIPT,
      1,
      `rl:${key}`,
      String(windowMs)
    )) as [number, number];
    return windowResult(res?.[0], res?.[1], limit, windowMs);
  } catch {
    return null; // fail-open: cai no contador em memória
  }
}

/** Há rate-limit durável (Redis) configurado? Usado pelo verificador de setup. */
export function rateLimitIsDurable(): boolean {
  return upstashEnv() !== null || !!process.env.REDIS_URL;
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
    return windowResult(data[0]?.result, data[2]?.result, limit, windowMs);
  } catch {
    return null;
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  const durable =
    (await rateLimitUpstash(key, limit, windowMs)) ??
    (await rateLimitRedis(key, limit, windowMs));
  return durable ?? rateLimitMemory(key, limit, windowMs);
}

/** IP do cliente a partir dos cabeçalhos do proxy. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
