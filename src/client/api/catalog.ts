import * as pharmacy from "@/actions/store/pharmacy";
import { catalogItemsSchema, catalogSuggestionsSchema } from "@/contracts/catalog";
import { cachedCatalog, catalogKey, setCatalogScope } from "@/client/api/cache";
import { requestJson, type RequestOptions } from "@/client/api/http";
import { adaptAction, apiFailure } from "@/client/api/result";

export { submitReview } from "@/client/api/form-actions";
export type { ProductCard, ProductSuggestion } from "@/contracts/catalog";
export type { FormState as ReviewState } from "@/contracts/result";
export type { SetPharmacyResult } from "@/contracts/forms";
export { invalidateCatalog, setCatalogScope } from "@/client/api/cache";
type CatalogOptions = RequestOptions & { pharmacyId?: string | null; fresh?: boolean };

export async function setSelectedPharmacy(...args: Parameters<typeof pharmacy.setSelectedPharmacy>) {
  const result = await adaptAction(pharmacy.setSelectedPharmacy)(...args);
  if (result.ok) setCatalogScope(result.pharmacyId);
  return result;
}

export function searchCatalog(query: string, options: CatalogOptions = {}) {
  if (options.signal?.aborted) return Promise.resolve(apiFailure("ABORTED"));
  const path = `/api/search?q=${encodeURIComponent(query.trim().slice(0, 200))}`;
  return cachedCatalog(options.fresh ? null : catalogKey(path, options.pharmacyId), () => requestJson(path, catalogSuggestionsSchema, options), (result) => result.ok);
}

export function getProductsByIds(ids: string[], options: CatalogOptions = {}) {
  if (options.signal?.aborted) return Promise.resolve(apiFailure("ABORTED"));
  const safeIds = [...new Set(ids)].filter((id) => typeof id === "string" && id.length > 0 && id.length <= 128).slice(0, 100);
  const path = `/api/products/by-ids?ids=${encodeURIComponent(safeIds.join(","))}`;
  return cachedCatalog(options.fresh ? null : catalogKey(path, options.pharmacyId), () => requestJson(path, catalogItemsSchema, options), (result) => result.ok);
}
