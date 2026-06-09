"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  PackageSearch,
  TicketPercent,
  FileText,
  Users,
  Store,
  LogOut,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/receitas", label: "Receitas", icon: FileText },
  { href: "/admin/produtos", label: "Produtos", icon: Boxes },
  { href: "/admin/estoque", label: "Estoque", icon: PackageSearch },
  { href: "/admin/cupons", label: "Cupons", icon: TicketPercent },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r lg:border-border lg:bg-card">
      <div className="flex h-full flex-col">
        <div className="hidden items-center gap-2.5 px-6 py-5 lg:flex">
          <span className="grid size-10 place-items-center rounded-2xl gradient-brand text-white">
            <Plus className="size-5" strokeWidth={3} />
          </span>
          <div>
            <p className="text-sm font-extrabold leading-tight">FarmaVida</p>
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              Painel Admin
            </p>
          </div>
        </div>

        <nav className="no-scrollbar flex gap-2 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:py-2">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition lg:shrink",
                  active
                    ? "bg-brand-600 text-white shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden gap-1 border-t border-border p-3 lg:flex lg:flex-col">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Store className="size-5" /> Ver loja
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
            >
              <LogOut className="size-5" /> Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
