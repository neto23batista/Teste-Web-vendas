import Link from "next/link";
import type { Metadata } from "next";
import { SearchX, ChevronLeft, ChevronRight } from "lucide-react";
import { getCategories, getBrands, searchProducts, type CatalogParams } from "@/lib/products";
import { ProductGrid } from "@/components/store/product-grid";
import { CatalogControls } from "@/components/store/catalog-controls";
import { categoryIcon } from "@/components/store/category-visual";
import { Reveal } from "@/components/motion/motion";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catálogo" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim() || undefined;
  const cat = one(sp.cat) || undefined;
  const brand = one(sp.marca) || undefined;
  const sort = (one(sp.sort) as CatalogParams["sort"]) || "relevancia";
  const promo = !!one(sp.promo);
  const generic = !!one(sp.generic);
  // rx=0 → só produtos de venda livre (sem receita).
  const rx = one(sp.rx) === "0" ? false : undefined;
  const num = (v?: string) => {
    const n = Number((v ?? "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const priceMin = num(one(sp.pmin));
  const priceMax = num(one(sp.pmax));
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const [categories, brands, result] = await Promise.all([
    getCategories(),
    getBrands(),
    searchProducts({ q, cat, brand, sort, promo, generic, rx, priceMin, priceMax, page }),
  ]);

  const activeCat = categories.find((c) => c.slug === cat);
  const title = q
    ? `Resultados para “${q}”`
    : activeCat
      ? activeCat.name
      : promo
        ? "Ofertas"
        : "Catálogo completo";

  // Querystring com todos os filtros ativos — base para os links de
  // categoria e paginação (troca de categoria preserva os demais filtros).
  const baseParams = () => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cat) p.set("cat", cat);
    if (brand) p.set("marca", brand);
    if (promo) p.set("promo", "1");
    if (generic) p.set("generic", "1");
    if (rx === false) p.set("rx", "0");
    if (priceMin != null) p.set("pmin", String(priceMin));
    if (priceMax != null) p.set("pmax", String(priceMax));
    if (sort !== "relevancia") p.set("sort", sort);
    return p;
  };

  const catHref = (slug?: string) => {
    const p = baseParams();
    p.delete("cat");
    if (slug) p.set("cat", slug);
    const s = p.toString();
    return `/catalogo${s ? `?${s}` : ""}`;
  };

  const pageHref = (n: number) => {
    const p = baseParams();
    if (n > 1) p.set("page", String(n));
    const s = p.toString();
    return `/catalogo${s ? `?${s}` : ""}`;
  };

  return (
    <div className="container-page space-y-6 py-6 md:py-8">
      <Reveal>
        <p className="text-sm text-muted-foreground">Farmácia online</p>
        <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
      </Reveal>

      {/* Categorias */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <Link
          href={catHref()}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95",
            !cat
              ? "border-brand-600 bg-brand-600 text-white shadow-[var(--shadow-soft)]"
              : "border-border bg-card hover:border-brand-300 hover:-translate-y-0.5"
          )}
        >
          Todos
        </Link>
        {categories.map((c) => {
          const Icon = categoryIcon(c.icon);
          return (
            <Link
              key={c.id}
              href={catHref(c.slug)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95",
                cat === c.slug
                  ? "border-brand-600 bg-brand-600 text-white shadow-[var(--shadow-soft)]"
                  : "border-border bg-card hover:border-brand-300 hover:-translate-y-0.5"
              )}
            >
              <Icon className="size-4" /> {c.name}
            </Link>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{result.total}</strong>{" "}
          {result.total === 1 ? "produto" : "produtos"}
        </p>
        <div className="sm:ml-auto sm:w-auto">
          <CatalogControls
            brands={brands.map((b) => ({ slug: b.slug, name: b.name }))}
          />
        </div>
      </div>

      {/* Resultados */}
      {result.items.length === 0 ? (
        <Reveal className="grid place-items-center gap-3 rounded-3xl border border-dashed border-border bg-card py-20 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <SearchX className="size-8" />
          </span>
          <p className="text-lg font-bold">Nenhum produto encontrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Tente remover os filtros ou buscar por outro termo.
          </p>
          <Link
            href="/catalogo"
            className="mt-2 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Limpar filtros
          </Link>
        </Reveal>
      ) : (
        <ProductGrid products={result.items} />
      )}

      {/* Paginação */}
      {result.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className="grid size-10 place-items-center rounded-xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-brand-300 active:scale-90"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-5" />
            </Link>
          )}
          {Array.from({ length: result.pages }).map((_, i) => {
            const n = i + 1;
            return (
              <Link
                key={n}
                href={pageHref(n)}
                className={cn(
                  "grid size-10 place-items-center rounded-xl border text-sm font-semibold transition",
                  n === page
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-border bg-card hover:border-brand-300"
                )}
              >
                {n}
              </Link>
            );
          })}
          {page < result.pages && (
            <Link
              href={pageHref(page + 1)}
              className="grid size-10 place-items-center rounded-xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-brand-300 active:scale-90"
              aria-label="Próxima página"
            >
              <ChevronRight className="size-5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
