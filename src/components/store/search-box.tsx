"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight, TrendingUp } from "lucide-react";
import { formatBRL, cn } from "@/lib/utils";

type Suggestion = {
  name: string;
  slug: string;
  emoji: string | null;
  image: string | null;
  price: number;
  oldPrice: number | null;
  category: string;
};

/**
 * Busca com sugestões instantâneas (autocomplete). Funciona como uma busca
 * normal mesmo sem JS — o <form> aponta para /catalogo?q=… via GET. Com JS,
 * mostra um dropdown com os produtos mais relevantes e navegação por teclado.
 */
export function SearchBox({
  placeholder = "Buscar medicamento, marca ou princípio ativo…",
  className,
  autoFocus,
}: {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<Suggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const rootRef = React.useRef<HTMLFormElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Busca com debounce. O estado de "carregando"/limpeza é setado no onChange
  // (evento); o efeito só agenda o fetch e atualiza no callback assíncrono.
  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        const data = await res.json();
        setItems(data.items ?? []);
        setActive(-1);
      } catch {
        /* abort/rede — ignora */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  // Fecha ao clicar fora.
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function goToCatalog() {
    const term = q.trim();
    setOpen(false);
    if (term) router.push(`/catalogo?q=${encodeURIComponent(term)}`);
  }

  function goToProduct(slug: string) {
    setOpen(false);
    router.push(`/produto/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && q.trim().length >= 2;

  return (
    <form
      ref={rootRef}
      role="search"
      action="/catalogo"
      method="get"
      onSubmit={(e) => {
        // Enter com item destacado abre o produto; senão vai ao catálogo.
        if (active >= 0 && items[active]) {
          e.preventDefault();
          goToProduct(items[active].slug);
        } else {
          e.preventDefault();
          goToCatalog();
        }
      }}
      className={cn("relative", className)}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        name="q"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          setOpen(true);
          if (v.trim().length >= 2) {
            setLoading(true);
          } else {
            setLoading(false);
            setItems([]);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Buscar produtos"
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="search-suggestions"
        className="h-12 w-full rounded-2xl border border-border bg-muted/60 pl-12 pr-10 text-sm outline-none transition focus:border-brand-400 focus:bg-card"
      />
      {loading && (
        <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {showDropdown && (
        <div
          id="search-suggestions"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
        >
          {items.length > 0 ? (
            <ul className="max-h-[22rem] overflow-y-auto py-1">
              {items.map((it, i) => (
                <li key={it.slug}>
                  <Link
                    href={`/produto/${it.slug}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 transition",
                      active === i ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.image}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">{it.emoji ?? "💊"}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {it.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {it.category}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-brand-700 dark:text-brand-400">
                        {formatBRL(it.price)}
                      </span>
                      {it.oldPrice != null && (
                        <span className="block text-xs text-muted-foreground line-through">
                          {formatBRL(it.oldPrice)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            !loading && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado para “{q.trim()}”.
              </p>
            )
          )}

          <button
            type="button"
            onClick={goToCatalog}
            className="flex w-full items-center justify-between border-t border-border px-4 py-3 text-sm font-semibold text-brand-600 transition hover:bg-muted dark:text-brand-400"
          >
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="size-4" /> Ver todos os resultados
            </span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}
    </form>
  );
}
