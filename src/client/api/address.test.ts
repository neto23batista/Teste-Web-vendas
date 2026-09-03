import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupCep, lookupCepResult } from "@/client/api/address";

afterEach(() => vi.unstubAllGlobals());

describe("postal autofill adapter", () => {
  it("uses validated digits, a fixed origin and no account credentials", async () => {
    const fetchMock = vi.fn(async () => Response.json({ logradouro: "Rua A", bairro: "Centro", localidade: "Santo André", uf: "SP", unwanted: "ignored" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await lookupCep("09000-000")).toEqual({ street: "Rua A", district: "Centro", city: "Santo André", state: "SP" });
    expect(fetchMock).toHaveBeenCalledWith("https://viacep.com.br/ws/09000000/json/", expect.objectContaining({ credentials: "omit", cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(await lookupCep("123")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves manual entry available for unavailable or malformed responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ erro: true })));
    expect(await lookupCepResult("09000000")).toMatchObject({ ok: false, code: "NOT_FOUND" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "private provider response" })));
    expect(await lookupCepResult("09000000")).toMatchObject({ ok: false, code: "INVALID_RESPONSE" });
    expect(await lookupCep("09000000")).toBeNull();
  });

  it("does not start a request when its form has already canceled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    expect(await lookupCepResult("09000000", { signal: controller.signal })).toMatchObject({ ok: false, code: "ABORTED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
