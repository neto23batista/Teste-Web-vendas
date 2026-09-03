"use client";

import { useSyncExternalStore } from "react";
import { getCatalogScopeVersion, subscribeCatalogScope } from "@/client/api/cache";

/** Consumers include this version in their request key and effect dependencies. */
export function useCatalogScopeVersion() {
  return useSyncExternalStore(subscribeCatalogScope, getCatalogScopeVersion, () => 0);
}
