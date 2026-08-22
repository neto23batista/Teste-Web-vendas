import { afterEach, describe, expect, it, vi } from "vitest";
import { redactLogValue, reportError } from "@/lib/monitoring";

afterEach(() => vi.restoreAllMocks());

describe("monitoring", () => {
  it("remove credenciais, tokens e e-mail de valores de log", () => {
    const input =
      "Bearer abc123 sk_live_abcdefghijklmnop user@example.com " +
      "postgresql://user:pass@db.test/store?token=supersecret " +
      "rediss://default:redis-pass@cache.test/0?signature=signed";
    const output = redactLogValue(input);

    expect(output).not.toContain("abc123");
    expect(output).not.toContain("sk_live_");
    expect(output).not.toContain("user@example.com");
    expect(output).not.toContain("user:pass");
    expect(output).not.toContain("supersecret");
    expect(output).not.toContain("redis-pass");
    expect(output).not.toContain("signed");
  });

  it("sanitiza mensagem, stack e contexto antes do console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("falha para pessoa@example.com?token=segredo");
    reportError(error, { path: "/rota?token=segredo" });

    const serialized = String(spy.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("pessoa@example.com");
    expect(serialized).not.toContain("token=segredo");
    expect(serialized).toContain("[redacted]");
  });
});
