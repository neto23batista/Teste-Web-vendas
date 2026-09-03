import { afterEach, describe, expect, it, vi } from "vitest";
import { adaptAction, asApiResult, normalizeActionResult, publicError, safeWarning, withReadTimeout } from "@/client/api/result";

afterEach(() => vi.useRealTimers());

describe("public API result boundary", () => {
  it("never reflects provider or database messages from returned or thrown errors", async () => {
    const secret = "sk_live_example_secret";
    const returned = normalizeActionResult({ ok: false, error: `Stripe rejected ${secret}: Prisma payment update` });
    const thrown = await adaptAction(async () => { throw new Error(`Database password=${secret}`); })();
    expect(returned).toMatchObject({ ok: false, code: "INTERNAL_ERROR", retryable: false });
    expect(thrown).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
    expect(JSON.stringify([returned, thrown])).not.toContain(secret);
  });

  it("normalizes concurrent state failures into stable actionable codes", () => {
    expect(publicError("O pedido mudou em outra operação. Atualize a página.").code).toBe("ORDER_STATE_CHANGED");
    expect(publicError("Sem estoque nesta unidade.").code).toBe("OUT_OF_STOCK");
    expect(publicError("Cupom expirado.").code).toBe("INVALID_COUPON");
    expect(publicError("Muitas tentativas em sequência.").code).toBe("RATE_LIMITED");
    expect(publicError({ error: "prisma", digest: "116209184" }).reference).toBe("116209184");
    expect(publicError({ reference: "https://secret.invalid/key" }).reference).toBeUndefined();
    expect(publicError("Informe um CPF válido.").message).toBe("Informe um CPF válido.");
    expect(publicError("Dados de acesso ou código de autenticação incorretos.").message).toBe("Dados de acesso ou código de autenticação incorretos.");
    expect(publicError("Esta tentativa já foi encerrada. Tente novamente para criar um novo pedido.").code).toBe("ORDER_STATE_CHANGED");
  });

  it("does not fabricate success when an action returns no acknowledgement", () => {
    expect(normalizeActionResult(undefined)).toMatchObject({ ok: false, code: "INVALID_RESPONSE" });
  });

  it("keeps uncertain database outcomes separate from coupon validation", () => {
    expect(publicError("Invalid prisma.coupon.update invocation").code).toBe("INTERNAL_ERROR");
    expect(publicError("Não foi possível criar o pedido. Nenhum cupom ou ponto foi consumido.").code).toBe("INTERNAL_ERROR");
    expect(publicError("Cupom expirado.").code).toBe("INVALID_COUPON");
  });

  it("bounds a stalled quote without retrying or replacing the timeout with a late result", async () => {
    vi.useFakeTimers();
    let resolve!: (value: { ok: boolean; total: number }) => void;
    const read = vi.fn(() => new Promise<{ ok: boolean; total: number }>(done => { resolve = done; }));
    const pending = withReadTimeout(read, 40)();
    await vi.advanceTimersByTimeAsync(40);
    expect(await pending).toMatchObject({ ok: false, code: "TIMEOUT" });
    resolve({ ok: true, total: 300 });
    await Promise.resolve();
    expect(await pending).toMatchObject({ ok: false, code: "TIMEOUT" });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("preserves successful data and partial-success warnings without claiming a refund is completed", () => {
    const value = normalizeActionResult({ ok: true, count: 3, warning: "Pedido cancelado; reembolso ainda em processamento no Stripe." });
    expect(value).toMatchObject({ ok: true, count: 3, data: { count: 3 } });
    expect(value.warning).toContain("ainda aguarda confirmação");
    expect(value.warning).not.toContain("Stripe");
    expect(safeWarning("Error sk_live_secret reembolso falhou")).not.toContain("sk_live");
    expect(asApiResult<{ count: number }>(value)).toMatchObject({ ok: true, data: { count: 3 } });
  });

  it.each(["NEXT_REDIRECT;replace;/conta;303;", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK;404"])("preserves framework control flow: %s", async (digest) => {
    const error = Object.assign(new Error("navigation"), { digest });
    const fn = vi.fn(async () => { throw error; });
    await expect(adaptAction(fn)()).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not repeat a mutation after an uncertain response and invalidates stale reads", async () => {
    const action = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    const invalidate = vi.fn();
    const result = await adaptAction(action, { invalidate, failureDefaults: { created: 0, errors: [] } })();
    expect(result).toMatchObject({ ok: false, code: "NETWORK_ERROR", created: 0, errors: [] });
    expect(action).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("sanitizes per-line import diagnostics as well as top-level errors", () => {
    const result = normalizeActionResult({ ok: true, created: 0, errors: ["Linha 7: Prisma SQL secret password", "sk_live_not_for_ui"] });
    expect(result.errors[0]).toMatch(/^Linha 7: /);
    expect(JSON.stringify(result)).not.toMatch(/Prisma|SQL|password|sk_live/);
  });
});
