"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/catalogo", label: "Catálogo", icon: LayoutGrid },
  { href: "/sacola", label: "Sacola", icon: ShoppingBag },
  { href: "/conta", label: "Conta", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium transition-colors",
                  active
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-muted-foreground"
                )}
              >
                <span className="relative grid size-9 place-items-center rounded-xl">
                  {/* Indicador compartilhado que desliza entre as abas */}
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-active"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-brand-600/20"
                    />
                  )}
                  <motion.span
                    whileTap={{ scale: 0.82 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="relative z-10 grid place-items-center"
                  >
                    <Icon className="size-5" />
                  </motion.span>
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
