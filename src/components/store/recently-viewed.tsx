"use client";

import * as React from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { ProductImage } from "@/components/store/product-image";

/**
 * "Vistos recentemente" — 100% no navegador (localStorage), sem tocar no banco:
 * privacidade simples e zero custo. O tracker roda na página do produto; o
 * rail aparece na home quando houver histórico.
 */
const KEY = "fv_recent";
const MAX = 8;

type RecentItem = {
  slug: string;
  name: string;
  emoji: string | null;
  image: string | null;
  price: number;
};

const EMPTY: RecentItem[] = [];
// Snapshot memoizado pela string crua — useSyncExternalStore exige referência
// estável quando o valor não mudou (senão entra em loop de re-render).
let cacheRaw: string | null = null;
let cacheParsed: RecentItem[] = EMPTY;

function readRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cacheRaw) return cacheParsed;
    cacheRaw = raw;
    const list = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    cacheParsed = Array.isArray(list)
      ? list.filter((i) => i && i.slug && i.name)
      : EMPTY;
  } catch {
    cacheParsed = EMPTY;
  }
  return cacheParsed;
}

// "storage" dispara em outras abas; na mesma aba a navegação remonta o rail.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** Registra o produto visto (dedup por slug, mais recente primeiro). */
export function TrackRecentView({ product }: { product: RecentItem }) {
  React.useEffect(() => {
    try {
      const list = [
        product,
        ...readRecent().filter((i) => i.slug !== product.slug),
      ].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(list));
      cacheRaw = null; // invalida o snapshot memoizado
    } catch {
      // storage cheio/bloqueado — recurso é opcional.
    }
  }, [product]);
  return null;
}

/** Rail horizontal com os últimos produtos vistos (home). */
export function RecentlyViewedRail() {
  // No servidor (e na hidratação) o rail é vazio; o React troca para o
  // snapshot do localStorage logo após hidratar — sem mismatch.
  const items = React.useSyncExternalStore(subscribe, readRecent, () => EMPTY);

  if (items.length === 0) return null;

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <History className="size-5 text-brand-600 dark:text-brand-400" />
        <h2 className="text-xl font-bold md:text-2xl">Vistos recentemente</h2>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {items.map((it) => (
          <Link
            key={it.slug}
            href={`/produto/${it.slug}`}
            className="press hover-glow group w-36 shrink-0 rounded-2xl border border-border bg-card p-3 transition hover:border-brand-300/70 dark:hover:border-brand-400/40"
          >
            <ProductImage
              src={it.image ?? undefined}
              emoji={it.emoji}
              name={it.name}
              className="aspect-square w-full rounded-xl"
              emojiClassName="text-4xl transition-transform duration-300 group-hover:-rotate-6"
            />
            <p className="mt-2 line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-snug">
              {it.name}
            </p>
            <p className="mt-1 text-sm font-extrabold text-brand-700 dark:text-brand-400">
              {formatBRL(it.price)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
