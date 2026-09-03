import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedCatalog, catalogKey, getCatalogScopeVersion, invalidateCatalog, setCatalogScope, subscribeCatalogScope } from "@/client/api/cache";

beforeEach(() => { vi.stubGlobal("window", {}); setCatalogScope(null); invalidateCatalog(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("unit-scoped short catalog cache", () => {
  it("notifies active views on unit changes and mutations, but never on reads", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCatalogScope(listener);
    const previous = getCatalogScopeVersion();
    setCatalogScope("unit-a");
    expect(getCatalogScopeVersion()).toBe(previous + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    await cachedCatalog("key", async () => 1, () => true);
    expect(listener).toHaveBeenCalledTimes(1);
    invalidateCatalog();
    expect(listener).toHaveBeenCalledTimes(2);
    setCatalogScope("unit-a");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    invalidateCatalog();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not reuse prices when the unit is unknown and isolates known units", async () => {
    const read = vi.fn(async () => ({ ok: true, price: 10 }));
    await cachedCatalog(catalogKey("search"), read, value => value.ok);
    await cachedCatalog(catalogKey("search"), read, value => value.ok);
    expect(read).toHaveBeenCalledTimes(2);
    setCatalogScope("unit-a");
    await cachedCatalog(catalogKey("search"), read, value => value.ok);
    await cachedCatalog(catalogKey("search"), read, value => value.ok);
    expect(read).toHaveBeenCalledTimes(3);
    setCatalogScope("unit-b");
    await cachedCatalog(catalogKey("search"), read, value => value.ok);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("expires after 15 seconds and never caches failed reads", async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => ({ ok: true }));
    await cachedCatalog("key", read, value => value.ok);
    await vi.advanceTimersByTimeAsync(15_001);
    await cachedCatalog("key", read, value => value.ok);
    expect(read).toHaveBeenCalledTimes(2);
    const failed = vi.fn(async () => ({ ok: false }));
    await cachedCatalog("failed", failed, value => value.ok);
    await cachedCatalog("failed", failed, value => value.ok);
    expect(failed).toHaveBeenCalledTimes(2);
  });

  it("does not let an old in-flight response refill cache after a mutation", async () => {
    let resolve!: (value: number) => void;
    const slow = cachedCatalog("key", () => new Promise<number>(done => { resolve = done; }), () => true);
    invalidateCatalog();
    resolve(1);
    await slow;
    const fresh = vi.fn(async () => 2);
    expect(await cachedCatalog("key", fresh, () => true)).toBe(2);
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest overlapping response and never shares browser cache on the server", async () => {
    let resolve!: (value: number) => void;
    const slow = cachedCatalog("key", () => new Promise<number>(done => { resolve = done; }), () => true);
    await cachedCatalog("key", async () => 2, () => true);
    resolve(1);
    await slow;
    expect(await cachedCatalog("key", async () => 3, () => true)).toBe(2);
    vi.stubGlobal("window", undefined);
    expect(await cachedCatalog("key", async () => 4, () => true)).toBe(4);
  });
});
