"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowUpDown, Leaf, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const sorts = [
  { value: "relevancia", label: "Relevância" },
  { value: "menor", label: "Menor preço" },
  { value: "maior", label: "Maior preço" },
  { value: "nome", label: "Nome (A-Z)" },
];

export function CatalogControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggle(key: string) {
    update(key, params.get(key) ? null : "1");
  }

  const promo = !!params.get("promo");
  const generic = !!params.get("generic");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => toggle("promo")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
          promo
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-border bg-card hover:border-brand-300"
        )}
      >
        <Tag className="size-4" /> Ofertas
      </button>
      <button
        onClick={() => toggle("generic")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
          generic
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-border bg-card hover:border-emerald-300"
        )}
      >
        <Leaf className="size-4" /> Genéricos
      </button>

      <div className="relative ml-auto">
        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <select
          aria-label="Ordenar"
          value={params.get("sort") ?? "relevancia"}
          onChange={(e) => update("sort", e.target.value)}
          className="h-10 appearance-none rounded-full border border-border bg-card pl-9 pr-8 text-sm font-semibold outline-none transition focus:border-brand-400"
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
