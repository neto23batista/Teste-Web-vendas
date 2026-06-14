import Link from "next/link";
import { ShoppingBag, User } from "lucide-react";
import { Brand } from "@/components/store/brand";
import { SearchBox } from "@/components/store/search-box";
import { CartBadge } from "@/components/store/cart-badge";
import { PharmacySelector } from "@/components/store/pharmacy-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCartCount } from "@/lib/cart";
import { getCurrentUser } from "@/lib/session";
import { listPharmaciesSafe, getSelectedPharmacyId } from "@/lib/pharmacy";

export async function SiteHeader() {
  const [count, user, pharmacies, selectedId] = await Promise.all([
    getCartCount(),
    getCurrentUser(),
    listPharmaciesSafe(),
    getSelectedPharmacyId(),
  ]);
  const current = pharmacies.find((p) => p.id === selectedId) ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 shadow-[0_1px_0_0_color-mix(in_oklab,var(--border)_50%,transparent)] backdrop-blur-xl backdrop-saturate-150">
      <div className="container-page flex h-16 items-center gap-3 md:h-18">
        <Brand />

        <SearchBox className="ml-2 hidden flex-1 md:block" />

        <nav className="ml-auto flex items-center gap-1 md:gap-2">
          {pharmacies.length > 0 && (
            <PharmacySelector current={current} pharmacies={pharmacies} />
          )}
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
        <SearchBox placeholder="Buscar na farmácia…" />
      </div>
    </header>
  );
}
