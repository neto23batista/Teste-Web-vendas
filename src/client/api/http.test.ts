import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { requestJson } from "@/client/api/http";

const schema = z.object({ status: z.literal("PAID") });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("same-origin HTTP transport", () => {
  it("validates JSON and keeps financial and personal reads out of browser caches", async () => {
    const fetchMock = vi.fn(async () => Response.json({ status: "PAID", secret: "not-a-contract-field" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestJson("/api/orders/ABC/status", schema)).toEqual({ ok: true, data: { status: "PAID" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/orders/ABC/status", expect.objectContaining({ cache: "no-store", credentials: "same-origin" }));
  });

  it("rejects schema drift and HTML session redirects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "SQL error password" })));
    expect(await requestJson("/api/orders/ABC/status", schema)).toMatchObject({ ok: false, code: "INVALID_RESPONSE" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<h1>Login</h1>", { headers: { "content-type": "text/html" } })));
    expect(await requestJson("/api/orders/ABC/status", schema)).toMatchObject({ ok: false, code: "INVALID_RESPONSE" });
  });

  it("turns HTTP errors into stable codes without consuming provider details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "SQL password leaked" }, { status: 409, headers: { "x-request-id": "trace_123" } })));
    const value = await requestJson("/api/account/export", schema);
    expect(value).toMatchObject({ ok: false, code: "CONFLICT", reference: "trace_123" });
    expect(JSON.stringify(value)).not.toContain("password");
  });

  it("times out the full request and aborts its transport without retry", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const pending = requestJson("/api/account/export", schema, { method: "POST", timeoutMs: 40 });
    await vi.advanceTimersByTimeAsync(40);
    expect(await pending).toMatchObject({ ok: false, code: "TIMEOUT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
  });

  it("supports component unmount cancellation and avoids starting pre-aborted calls", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const pending = requestJson("/api/search?q=test", schema, { signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, code: "ABORTED" });
    expect(await requestJson("/api/search?q=test", schema, { signal: controller.signal })).toMatchObject({ ok: false, code: "ABORTED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not allow the private BFF client to call an external origin", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestJson("https://other.invalid/api", schema)).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
