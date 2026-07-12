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
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth";

const items = [
  { href: "/conta", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/conta/pedidos", label: "Meus pedidos", icon: Package },
  { href: "/conta/favoritos", label: "Favoritos", icon: Heart },
  { href: "/conta/enderecos", label: "Endereços", icon: MapPin },
  { href: "/conta/fidelidade", label: "Fidelidade", icon: Gift },
  { href: "/conta/assinaturas", label: "Assinaturas", icon: Repeat },
  { href: "/conta/perfil", label: "Meus dados", icon: UserCog },
  { href: "/conta/privacidade", label: "Privacidade", icon: ShieldCheck },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 lg:flex-col lg:overflow-visible">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition lg:shrink",
              active
                ? "bg-brand-600 text-white shadow-[var(--shadow-soft)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4.5" />
            {label}
          </Link>
        );
      })}
      <form action={logout} className="lg:mt-2 lg:border-t lg:border-border lg:pt-2">
        <button
          type="submit"
          className="flex w-full shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
        >
          <LogOut className="size-4.5" /> Sair
        </button>
      </form>
    </nav>
  );
}
