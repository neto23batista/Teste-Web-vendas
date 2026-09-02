"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Heart,
  MapPin,
  Gift,
  Repeat,
  UserCog,
  ShieldCheck,
  KeyRound,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/account/auth";

const items = [
  { href: "/conta", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/conta/pedidos", label: "Meus pedidos", icon: Package },
  { href: "/conta/favoritos", label: "Favoritos", icon: Heart },
  { href: "/conta/enderecos", label: "Endereços", icon: MapPin },
  { href: "/conta/fidelidade", label: "Fidelidade", icon: Gift },
  { href: "/conta/assinaturas", label: "Assinaturas", icon: Repeat },
  { href: "/conta/perfil", label: "Meus dados", icon: UserCog },
  { href: "/conta/seguranca", label: "Segurança", icon: KeyRound },
  { href: "/conta/privacidade", label: "Privacidade", icon: ShieldCheck },
];

function isItemActive(pathname: string, item: (typeof items)[number]) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AccountNav() {
  const pathname = usePathname();
  const currentItem = items.find((item) => isItemActive(pathname, item)) ?? items[0];
  const CurrentIcon = currentItem.icon;

  function navigationLinks() {
    return items.map((item) => {
      const { href, label, icon: Icon } = item;
      const active = isItemActive(pathname, item);
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
            active
              ? "bg-brand-600 text-white shadow-[var(--shadow-soft)]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="size-4.5 shrink-0" aria-hidden="true" />
          {label}
        </Link>
      );
    });
  }

  return (
    <>
      <details
        key={pathname}
        className="group rounded-2xl border border-border bg-card lg:hidden"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-2xl px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <CurrentIcon className="size-4.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-muted-foreground">
              Minha conta
            </span>
            <span className="block truncate text-sm font-bold">
              {currentItem.label}
            </span>
          </span>
          <ChevronDown
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-border p-2">
          <nav
            aria-label="Seções da minha conta"
            className="grid max-h-[60dvh] gap-1 overflow-y-auto"
          >
            {navigationLinks()}
          </nav>
          <form action={logout} className="mt-2 border-t border-border pt-2">
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
            >
              <LogOut className="size-4.5" aria-hidden="true" /> Sair
            </button>
          </form>
        </div>
      </details>

      <nav
        aria-label="Seções da minha conta"
        className="hidden rounded-2xl border border-border bg-card p-2 lg:flex lg:flex-col"
      >
        {navigationLinks()}
        <form action={logout} className="mt-2 border-t border-border pt-2">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
          >
            <LogOut className="size-4.5" aria-hidden="true" /> Sair
          </button>
        </form>
      </nav>
    </>
  );
}
