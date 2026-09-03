"use client";

import * as React from "react";
import { ProductImage } from "./product-image";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight, TrendingUp } from "lucide-react";
import { formatBRL, cn } from "@/lib/utils";
import { searchCatalog } from "@/client/api/catalog";
import { useCatalogScopeVersion } from "@/client/use-catalog-scope-version";

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
  const [rawItems, setItems] = React.useState<Suggestion[]>([]);
  const [resultKey, setResultKey] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [pending, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [retryKey, setRetryKey] = React.useState(0);
  const catalogVersion = useCatalogScopeVersion();
  const requestKey = JSON.stringify([q.trim(), retryKey, catalogVersion]);
  const items = resultKey === requestKey ? rawItems : [];
  const loading = pending || (q.trim().length >= 2 && resultKey !== requestKey);
  const [active, setActive] = React.useState(-1);
  const listId = React.useId();
  const statusId = React.useId();
  const rootRef = React.useRef<HTMLFormElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Atalho "/" foca a busca de qualquer lugar da página (vibe app/coder).
  // Ignora quando o usuário já está digitando em outro campo.
  React.useEffect(() => {
    function onSlash(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t?.isContentEditable;
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onSlash);
    return () => document.removeEventListener("keydown", onSlash);
  }, []);

  // Busca com debounce. O estado de "carregando"/limpeza é setado no onChange
  // (evento); o efeito só agenda o fetch e atualiza no callback assíncrono.
  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const result = await searchCatalog(term, { signal: ac.signal });
        if (ac.signal.aborted) return;
        if (!result.ok) throw new Error(result.code);
        setItems(result.data.items);
        setResultKey(requestKey);
        setError(false);
        setActive(-1);
      } catch (cause) {
        if (!ac.signal.aborted && !(cause instanceof DOMException && cause.name === "AbortError")) {
          setItems([]);
          setResultKey(requestKey);
          setError(true);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, retryKey, requestKey]);

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
        ref={inputRef}
        type="search"
        name="q"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          setOpen(true);
          setError(false);
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
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-activedescendant={
          active >= 0 && items[active] ? `${listId}-option-${active}` : undefined
        }
        aria-describedby={statusId}
        aria-busy={loading}
        className="h-12 w-full rounded-2xl border border-border bg-muted/60 pl-12 pr-10 text-base sm:text-sm transition focus:border-brand-400 focus:bg-card"
      />
      {loading ? (
        <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        !q && (
          <span
            aria-hidden
            className="kbd-chip pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 md:inline-grid"
          >
            /
          </span>
        )
      )}

      <span id={statusId} className="sr-only" aria-live="polite">
        {loading
          ? "Buscando produtos"
          : error
            ? "Não foi possível buscar produtos"
            : q.trim().length >= 2
              ? `${items.length} sugestões encontradas`
              : "Digite pelo menos dois caracteres"}
      </span>

      {showDropdown && (
        <div
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
        >
          <div
            id={listId}
            role={!error && items.length > 0 ? "listbox" : undefined}
            aria-label={!error && items.length > 0 ? "Sugestões de produtos" : undefined}
          >
            {error ? (
              <div className="space-y-3 px-4 py-5 text-center">
              <p className="text-sm text-danger-500" role="alert">
                Não foi possível carregar as sugestões.
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(false);
                  setLoading(true);
                  setRetryKey((current) => current + 1);
                }}
                className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Tentar novamente
              </button>
            </div>
            ) : items.length > 0 ? (
              <div className="max-h-[22rem] overflow-y-auto py-1">
              {items.map((it, i) => (
                <button
                    key={it.slug}
                    id={`${listId}-option-${i}`}
                    type="button"
                    role="option"
                    aria-selected={active === i}
                    onClick={() => goToProduct(it.slug)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                      active === i ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <ProductImage src={it.image} name={it.name} sizes="44px" className="size-11 shrink-0 rounded-xl border border-border" />
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
                </button>
              ))}
              </div>
            ) : (
              !loading && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado para “{q.trim()}”.
                </p>
              )
            )}
          </div>

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
