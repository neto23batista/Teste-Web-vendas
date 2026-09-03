"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Heart, Loader2, PackageSearch, RefreshCw } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { ProductCard } from "@/components/store/product-card";
import { Button } from "@/components/ui/button";
import { getProductsByIds } from "@/client/api/catalog";
import { useCatalogScopeVersion } from "@/client/use-catalog-scope-version";
import type { ProductCard as ProductCardData } from "@/lib/catalog";

export function FavoritesList() {
  const { favorites, ready } = useFavorites();
  const catalogVersion = useCatalogScopeVersion();
  const idsKey = favorites.join(",");
  const key = `${catalogVersion}:${idsKey}`;
  const [data, setData] = React.useState<{
    key: string;
    requestVersion: number;
    status: "idle" | "success" | "error";
    items: ProductCardData[];
  }>({ key: "", requestVersion: -1, status: "idle", items: [] });
  const [requestVersion, setRequestVersion] = React.useState(0);

  React.useEffect(() => {
    if (favorites.length === 0) return;
    const controller = new AbortController();

    void getProductsByIds(idsKey.split(","), {
      signal: controller.signal,
    })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (!payload.ok) throw new Error(payload.code);
        setData({
          key,
          requestVersion,
          status: "success",
          items: payload.data.items,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setData({ key, requestVersion, status: "error", items: [] });
        }
      });

    return () => {
      controller.abort();
    };
  }, [key, idsKey, favorites.length, requestVersion]);

  const currentRequest =
    data.key === key && data.requestVersion === requestVersion;
  const loading =
    !ready || (favorites.length > 0 && !currentRequest);
  const items =
    favorites.length > 0 && currentRequest && data.status === "success"
      ? data.items
      : [];

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid place-items-center py-20 text-muted-foreground"
      >
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Carregando seus produtos favoritos</span>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/15">
          <Heart className="size-7" />
        </span>
        <p className="font-semibold">Sua lista de favoritos está vazia</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Toque no coração dos produtos para salvá-los aqui e comprar quando
          quiser.
        </p>
        <Button asChild variant="primary">
          <Link href="/catalogo">Explorar catálogo</Link>
        </Button>
      </div>
    );
  }

  if (currentRequest && data.status === "error") {
    return (
      <div
        role="alert"
        className="grid place-items-center gap-3 rounded-2xl border border-danger-500/30 bg-danger-500/5 px-5 py-16 text-center"
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-danger-500/10 text-danger-500">
          <AlertCircle className="size-7" aria-hidden="true" />
        </span>
        <p className="font-semibold">Não foi possível carregar seus favoritos</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente. Sua lista continua salva
          neste dispositivo.
        </p>
        <Button
          variant="outline"
          onClick={() => setRequestVersion((version) => version + 1)}
        >
          <RefreshCw className="size-4" aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-5 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <PackageSearch className="size-7" aria-hidden="true" />
        </span>
        <p className="font-semibold">Seus produtos salvos não estão disponíveis</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Eles podem ter saído do catálogo ou estar indisponíveis para venda
          no momento.
        </p>
        <Button asChild variant="primary">
          <Link href="/catalogo">Explorar catálogo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
