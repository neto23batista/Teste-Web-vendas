/** Catalog-only cache. Private/financial queries must never enter this store. */
const CATALOG_TTL_MS = 15_000;
const MAX_ENTRIES = 80;
const catalog = new Map<string, { expiresAt: number; value: unknown; generation: number }>();
const requestVersions = new Map<string, number>();
let pharmacyScope: string | null = null;
let generation = 0;
let requestSequence = 0;
const listeners = new Set<() => void>();

export function getCatalogScopeVersion() { return generation; }
export function subscribeCatalogScope(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const CACHE_POLICY = {
  catalog: { ttlMs: CATALOG_TTL_MS, http: "no-store" },
  cart: { http: "no-store" },
  orders: { http: "no-store" },
  account: { http: "no-store" },
  admin: { http: "no-store" },
} as const;

export function setCatalogScope(pharmacyId: string | null) {
  if (pharmacyScope !== pharmacyId) {
    pharmacyScope = pharmacyId;
    invalidateCatalog();
  }
}

export function invalidateCatalog() {
  generation += 1;
  catalog.clear();
  requestVersions.clear();
  listeners.forEach((listener) => listener());
}

/** Unidentified cookie scope disables reuse rather than mixing unit prices. */
export function catalogKey(resource: string, explicitScope?: string | null): string | null {
  const scope = explicitScope === undefined ? pharmacyScope : explicitScope;
  return scope ? JSON.stringify([scope, resource]) : null;
}

export async function cachedCatalog<T>(key: string | null, read: () => Promise<T>, reusable: (value: T) => boolean): Promise<T> {
  // This cache is per browser tab. Never reuse cookie-scoped data in an RSC server process.
  if (!key || typeof window === "undefined") return read();
  const current = catalog.get(key);
  if (current && current.expiresAt > Date.now()) return current.value as T;
  const startedGeneration = generation;
  const requestVersion = ++requestSequence;
  requestVersions.set(key, requestVersion);
  try {
    const value = await read();
    if (startedGeneration === generation && requestVersions.get(key) === requestVersion && reusable(value)) {
      if (catalog.size >= MAX_ENTRIES) {
        const oldest = catalog.keys().next().value!;
        catalog.delete(oldest);
      }
      catalog.set(key, { value, generation, expiresAt: Date.now() + CATALOG_TTL_MS });
    }
    return value;
  } finally {
    if (requestVersions.get(key) === requestVersion) requestVersions.delete(key);
  }
}
