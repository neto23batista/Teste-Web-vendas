"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";
import { ProductCard } from "@/components/store/product-card";
import { Button } from "@/components/ui/button";
import type { ProductCard as ProductCardData } from "@/lib/products";

export function FavoritesList() {
  const { favorites, ready } = useFavorites();
  const key = favorites.join(",");
  const [data, setData] = React.useState<{
    key: string;
    items: ProductCardData[];
  }>({ key: "", items: [] });

  React.useEffect(() => {
    if (favorites.length === 0) return;
    let alive = true;
    fetch(`/api/products/by-ids?ids=${key}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData({ key, items: d.items ?? [] });
      })
      .catch(() => {
        if (alive) setData({ key, items: [] });
      });
    return () => {
      alive = false;
    };
  }, [key, favorites.length]);

  const fetched = data.key === key;
  const items = favorites.length === 0 ? [] : fetched ? data.items : [];

  if (!ready || (favorites.length > 0 && !fetched)) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
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

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
