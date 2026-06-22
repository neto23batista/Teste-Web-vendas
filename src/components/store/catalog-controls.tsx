"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowUpDown, Leaf, Tag, FileX2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterSheet } from "@/components/store/filter-sheet";

const sorts = [
  { value: "relevancia", label: "Relevância" },
  { value: "menor", label: "Menor preço" },
  { value: "maior", label: "Maior preço" },
  { value: "nome", label: "Nome (A-Z)" },
];

const chipCls = (active: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
    active
      ? "gradient-brand border-transparent text-white shadow-[var(--shadow-glow)]"
      : "border-border bg-card hover:border-brand-300"
  );

export function CatalogControls({
  brands = [],
}: {
  brands?: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(next: URLSearchParams) {
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    update(next);
  }

  function toggle(key: string, onValue = "1") {
    set(key, params.get(key) ? null : onValue);
  }

  const promo = !!params.get("promo");
  const generic = !!params.get("generic");
  const rxFree = params.get("rx") === "0";

  // Faixa de preço: aplica no Enter/blur (evita navegação a cada tecla).
  const [pmin, setPmin] = React.useState(params.get("pmin") ?? "");
  const [pmax, setPmax] = React.useState(params.get("pmax") ?? "");
  function applyPrice() {
    if ((params.get("pmin") ?? "") === pmin && (params.get("pmax") ?? "") === pmax)
      return;
    const next = new URLSearchParams(params.toString());
    if (pmin) next.set("pmin", pmin);
    else next.delete("pmin");
    if (pmax) next.set("pmax", pmax);
    else next.delete("pmax");
    update(next);
  }
  const priceKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyPrice();
    }
  };

  const priceInputCls =
    "h-10 w-20 rounded-full border border-border bg-card px-3 text-center text-sm font-semibold outline-none transition placeholder:font-normal placeholder:text-muted-foreground focus:border-brand-400";

  const sortSelect = (
    <div className="relative">
      <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <select
        aria-label="Ordenar"
        value={params.get("sort") ?? "relevancia"}
        onChange={(e) => set("sort", e.target.value)}
        className="h-10 appearance-none rounded-full border border-border bg-card pl-9 pr-8 text-sm font-semibold outline-none transition focus:border-brand-400"
      >
        {sorts.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      {/* Mobile: filtros num bottom-sheet (padrão de app) + ordenação. */}
      <div className="flex items-center gap-2 md:hidden">
        <FilterSheet brands={brands} />
        <div className="ml-auto">{sortSelect}</div>
      </div>

      {/* Desktop: controles inline. */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <button onClick={() => toggle("promo")} className={chipCls(promo)}>
          <Tag className="size-4" /> Ofertas
        </button>
        <button
          onClick={() => toggle("generic")}
          className={chipCls(generic)}
        >
          <Leaf className="size-4" /> Genéricos
        </button>
        <button
          onClick={() => toggle("rx", "0")}
          className={chipCls(rxFree)}
          title="Somente produtos que não exigem receita médica"
        >
          <FileX2 className="size-4" /> Sem receita
        </button>

        {brands.length > 0 && (
          <select
            aria-label="Filtrar por marca"
            value={params.get("marca") ?? ""}
            onChange={(e) => set("marca", e.target.value || null)}
            className="h-10 max-w-40 appearance-none rounded-full border border-border bg-card px-4 text-sm font-semibold outline-none transition focus:border-brand-400"
          >
            <option value="">Todas as marcas</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1.5">
          <input
            aria-label="Preço mínimo"
            inputMode="decimal"
            placeholder="R$ mín"
            value={pmin}
            onChange={(e) => setPmin(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={priceKey}
            className={priceInputCls}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            aria-label="Preço máximo"
            inputMode="decimal"
            placeholder="R$ máx"
            value={pmax}
            onChange={(e) => setPmax(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={priceKey}
            className={priceInputCls}
          />
        </div>

        <div className="ml-auto">{sortSelect}</div>
      </div>
    </>
  );
}
