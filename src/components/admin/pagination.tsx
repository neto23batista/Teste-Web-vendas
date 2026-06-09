import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Paginação server-side para as listas do admin. Preserva os filtros atuais
 * (ex.: q, status) via `baseParams` e troca apenas `page`.
 */
export function Pagination({
  page,
  pages,
  baseParams = {},
}: {
  page: number;
  pages: number;
  baseParams?: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `?${qs}` : "?";
  };

  // Janela de no máximo 5 páginas ao redor da atual.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  const items: number[] = [];
  for (let p = start; p <= end; p++) items.push(p);

  const base =
    "grid h-10 min-w-10 place-items-center rounded-xl border px-3 text-sm font-semibold transition";

  return (
    <nav
      className="flex items-center justify-center gap-1.5"
      aria-label="Paginação"
    >
      <Link
        href={href(page - 1)}
        aria-disabled={page <= 1}
        className={cn(
          base,
          page <= 1
            ? "pointer-events-none border-border text-muted-foreground opacity-50"
            : "border-border text-foreground hover:border-brand-300 hover:bg-muted"
        )}
      >
        <ChevronLeft className="size-4" />
      </Link>

      {items.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            base,
            p === page
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-border text-foreground hover:border-brand-300 hover:bg-muted"
          )}
        >
          {p}
        </Link>
      ))}

      <Link
        href={href(page + 1)}
        aria-disabled={page >= pages}
        className={cn(
          base,
          page >= pages
            ? "pointer-events-none border-border text-muted-foreground opacity-50"
            : "border-border text-foreground hover:border-brand-300 hover:bg-muted"
        )}
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
