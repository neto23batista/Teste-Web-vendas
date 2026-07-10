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
  Repeat,
  Settings,
  Star,
  ScrollText,
  Plug,
  Truck,
  ShoppingBasket,
  Wallet,
  BarChart3,
  IdCard,
} from "lucide-react";
import type { StaffProfile } from "@prisma/client";
import { cn } from "@/lib/utils";
import { canAccess, type Area } from "@/lib/permissions";
import { logout } from "@/actions/auth";

const items: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  area: Area;
  exact?: boolean;
  globalOnly?: boolean;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, area: "dashboard", exact: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart, area: "pedidos" },
  { href: "/admin/entregas", label: "Entregas", icon: Truck, area: "entregas" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, area: "clientes" },
  { href: "/admin/receitas", label: "Receitas", icon: FileText, area: "receitas" },
  { href: "/admin/avaliacoes", label: "Avaliações", icon: Star, area: "avaliacoes" },
  { href: "/admin/produtos", label: "Produtos", icon: Boxes, area: "produtos" },
  { href: "/admin/estoque", label: "Estoque", icon: PackageSearch, area: "estoque" },
  { href: "/admin/compras", label: "Compras", icon: ShoppingBasket, area: "compras" },
  { href: "/admin/cupons", label: "Cupons", icon: TicketPercent, area: "cupons" },
  { href: "/admin/assinaturas", label: "Assinaturas", icon: Repeat, area: "assinaturas", globalOnly: true },
  { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3, area: "relatorios" },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet, area: "financeiro" },
  { href: "/admin/integracao", label: "Integração", icon: Plug, area: "integracao" },
  { href: "/admin/equipe", label: "Equipe", icon: IdCard, area: "equipe", globalOnly: true },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, area: "auditoria", globalOnly: true },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings, area: "configuracoes" },
];

export function AdminSidebar({
  badges,
  isGlobal = false,
  staffProfile = null,
}: {
  badges?: Record<string, number>;
  isGlobal?: boolean;
  /** null = OWNER (conta legada) — vê tudo. */
  staffProfile?: StaffProfile | null;
}) {
  const pathname = usePathname();
  // O menu só mostra o que o perfil pode abrir (o middleware bloqueia o resto).
  const visibleItems = items.filter(
    (it) => (!it.globalOnly || isGlobal) && canAccess(staffProfile, it.area)
  );

  return (
    <aside className="lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r lg:border-border lg:bg-card print:hidden">
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
          {visibleItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            const count = badges?.[href] ?? 0;
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
                {count > 0 && (
                  <span
                    className={cn(
                      "ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                      active
                        ? "bg-white/25 text-white"
                        : "bg-danger-500 text-white"
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
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
