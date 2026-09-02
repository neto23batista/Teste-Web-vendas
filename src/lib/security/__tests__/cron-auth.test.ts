import { afterEach, describe, expect, it, vi } from "vitest";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";

const request = (authorization?: string) => ({
  headers: new Headers(authorization ? { authorization } : undefined),
});

afterEach(() => vi.unstubAllEnvs());

describe("cron auth", () => {
  it("aceita somente o bearer exato quando há segredo", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-value");
    expect(cronRequestAuthorized(request("Bearer cron-secret-value"))).toBe(true);
    expect(cronRequestAuthorized(request("Bearer cron-secret-valuE"))).toBe(false);
    expect(cronRequestAuthorized(request())).toBe(false);
  });

  it("falha fechado sem segredo em produção live ou NODE_ENV production", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("APP_ENV", "production");
    expect(cronRequestAuthorized(request())).toBe(false);

    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("NODE_ENV", "production");
    expect(cronRequestAuthorized(request())).toBe(false);
  });

  it("permite execução local sem segredo", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("NODE_ENV", "test");
    expect(cronRequestAuthorized(request())).toBe(true);
  });
});
