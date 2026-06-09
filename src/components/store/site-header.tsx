import Link from "next/link";
import { Search, ShoppingBag, User } from "lucide-react";
import { Brand } from "@/components/store/brand";
import { CartBadge } from "@/components/store/cart-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCartCount } from "@/lib/cart";
import { getCurrentUser } from "@/lib/session";

export async function SiteHeader() {
  const [count, user] = await Promise.all([getCartCount(), getCurrentUser()]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3 md:h-18">
        <Brand />

        <form
          action="/catalogo"
          method="get"
          role="search"
          className="relative ml-2 hidden flex-1 md:block"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="Buscar medicamento, marca ou princípio ativo…"
            aria-label="Buscar produtos"
            className="h-12 w-full rounded-2xl border border-border bg-muted/60 pl-12 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-card"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1 md:gap-2">
          <Link
            href="/catalogo"
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground lg:inline-flex"
          >
            Catálogo
          </Link>
          <ThemeToggle />
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={user ? "Minha conta" : "Entrar"}
          >
            <Link href={user ? "/conta" : "/login"}>
              <User className="size-5" />
            </Link>
          </Button>
          <Button asChild variant="primary" className="relative gap-2" aria-label="Sacola">
            <Link href="/sacola">
              <ShoppingBag className="size-5" />
              <span className="hidden sm:inline">Sacola</span>
              <CartBadge count={count} />
            </Link>
          </Button>
        </nav>
      </div>

      <div className="container-page pb-3 md:hidden">
        <form action="/catalogo" method="get" role="search" className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="Buscar na farmácia…"
            aria-label="Buscar produtos"
            className="h-12 w-full rounded-2xl border border-border bg-muted/60 pl-12 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-card"
          />
        </form>
      </div>
    </header>
  );
}
