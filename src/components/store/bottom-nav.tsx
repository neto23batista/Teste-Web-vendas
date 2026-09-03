"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { CartBadge } from "@/components/store/cart/cart-badge";

const items = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/catalogo", label: "Catálogo", icon: LayoutGrid },
  { href: "/sacola", label: "Sacola", icon: ShoppingBag, badge: true },
  { href: "/conta", label: "Conta", icon: User },
];

export function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-3 bottom-3 z-40 rounded-3xl glass-surface shadow-[var(--shadow-card)] md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {items.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.8125rem] font-semibold transition-colors",
                  active
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-muted-foreground"
                )}
              >
                <span className="relative grid size-9 place-items-center rounded-xl">
                  {/* Indicador compartilhado que desliza entre as abas */}
                  {active && (
                    <span
                      className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-brand-600/20"
                    />
                  )}
                  <span
                    className="relative z-10 grid place-items-center"
                  >
                    <Icon className="size-5" />
                    {badge && <CartBadge count={cartCount} />}
                  </span>
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
