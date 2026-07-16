import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// O módulo importa next/headers (usado só por clientIp) — mock para rodar fora
// do runtime do Next.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit (fallback em memória)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite até o limite e bloqueia o excedente com retryAfter", async () => {
    const key = `t1:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit(key, 3, 10_000)).ok).toBe(true);
    }
    const blocked = await rateLimit(key, 3, 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(10);
  });

  it("reabre a janela depois que ela expira", async () => {
    const key = `t2:${Math.random()}`;
    expect((await rateLimit(key, 1, 5_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 5_000)).ok).toBe(false);

    vi.advanceTimersByTime(5_001);
    expect((await rateLimit(key, 1, 5_000)).ok).toBe(true);
  });

  it("chaves diferentes não interferem entre si", async () => {
    const a = `t3a:${Math.random()}`;
    const b = `t3b:${Math.random()}`;
    expect((await rateLimit(a, 1, 10_000)).ok).toBe(true);
    expect((await rateLimit(a, 1, 10_000)).ok).toBe(false);
    expect((await rateLimit(b, 1, 10_000)).ok).toBe(true);
  });
});

describe("rateLimit com REDIS_URL malformada", () => {
  it("não lança e cai no contador em memória (fail-open)", async () => {
    // O singleton do cliente Redis é cacheado no 1º uso; recarrega o módulo para
    // que `getRedis()` releia a env já com o valor malformado.
    vi.resetModules();
    vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
    const prev = process.env.REDIS_URL;
    // Espaços + esquema quebrado: o construtor do ioredis faz `new URL(...)` e lança.
    process.env.REDIS_URL = "  redis://:::not a url:::  ";
    try {
      const { rateLimit: rl } = await import("@/lib/rate-limit");
      const key = `bad:${Math.random()}`;
      // Não deve lançar; a 1ª chamada passa (contador em memória).
      const first = await rl(key, 1, 10_000);
      expect(first.ok).toBe(true);
      // E o contador em memória continua valendo (2ª chamada bloqueia).
      const second = await rl(key, 1, 10_000);
      expect(second.ok).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = prev;
      vi.doUnmock("next/headers");
      vi.resetModules();
    }
  });
});
