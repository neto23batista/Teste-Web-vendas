import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@/lib/monitoring", () => ({ reportError: mocks.reportError }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// Sem cliente TCP nos testes: o caminho REST decide sozinho.
vi.mock("ioredis", () => ({ default: class {} }));

import { rateLimit } from "@/lib/security/rate-limit";

/**
 * O Redis está CONFIGURADO mas fora do ar — é o cenário que importa. Sem
 * configuração nenhuma (dev) não existe queda, e o fallback local é o esperado.
 */
function durableStoreDown() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-de-teste");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("connect ETIMEDOUT")),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("degradação do rate limit durável", () => {
  it("nega caminho de credencial em produção viva", async () => {
    durableStoreDown();
    vi.stubEnv("APP_ENV", "production");

    const result = await rateLimit("login:alguem", 5, 60_000, {
      critical: true,
    });

    // Contador por instância não protege contra força bruta distribuída: numa
    // queda do Redis, negar é a única resposta segura para credencial.
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("mantém o tráfego comum de pé na mesma queda", async () => {
    durableStoreDown();
    vi.stubEnv("APP_ENV", "production");

    // Busca e vitrine não justificam derrubar a loja inteira.
    expect((await rateLimit("search:1.2.3.4", 40, 10_000)).ok).toBe(true);
  });

  it("fora de produção viva, credencial continua caindo no contador local", async () => {
    durableStoreDown();
    vi.stubEnv("APP_ENV", "development");

    expect(
      (await rateLimit("login:alguem", 5, 60_000, { critical: true })).ok,
    ).toBe(true);
  });

  it("alerta a queda, mas no máximo uma vez por minuto", async () => {
    durableStoreDown();
    vi.stubEnv("APP_ENV", "production");

    // A janela de throttle é do módulo e sobrevive entre os testes deste
    // arquivo. Avança para além dela e zera a contagem antes de medir.
    vi.advanceTimersByTime(61_000);
    mocks.reportError.mockClear();

    for (let i = 0; i < 5; i++) {
      await rateLimit(`login:${i}`, 5, 60_000, { critical: true });
    }
    expect(mocks.reportError).toHaveBeenCalledTimes(1);
    expect(mocks.reportError.mock.calls[0]![1]).toMatchObject({
      operation: "rate_limit.durable_outage",
    });

    vi.advanceTimersByTime(61_000);
    await rateLimit("login:depois", 5, 60_000, { critical: true });
    expect(mocks.reportError).toHaveBeenCalledTimes(2);
  });

  it("sem Redis configurado não há incidente a reportar", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("APP_ENV", "development");

    await rateLimit("login:dev", 5, 60_000, { critical: true });

    expect(mocks.reportError).not.toHaveBeenCalled();
  });
});
