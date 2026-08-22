"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  PackageSearch,
  TicketPercent,
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
  ChevronDown,
  Menu,
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

function isItemActive(
  pathname: string,
  item: (typeof items)[number]
): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

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
  const currentItem = visibleItems.find((item) => isItemActive(pathname, item));
  const CurrentIcon = currentItem?.icon ?? Menu;

  function navigationLinks() {
    return visibleItems.map((item) => {
      const { href, label, icon: Icon } = item;
      const active = isItemActive(pathname, item);
      const count = badges?.[href] ?? 0;
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
            active
              ? "bg-brand-600 text-white shadow-[var(--shadow-soft)]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          <span>{label}</span>
          {count > 0 && (
            <span
              aria-label={`${count > 99 ? "mais de 99" : count} pendências`}
              className={cn(
                "ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums",
                active ? "bg-white/25 text-white" : "bg-danger-500 text-white"
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
      );
    });
  }

  return (
    <aside
      aria-label="Navegação administrativa"
      className="border-b border-border bg-card lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r print:hidden"
    >
      <div className="p-3 lg:hidden">
        <details
          key={pathname}
          className="group rounded-2xl border border-border bg-background"
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-2xl px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
              <CurrentIcon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-muted-foreground">
                Seção atual
              </span>
              <span className="block truncate text-sm font-bold">
                {currentItem?.label ?? "Abrir menu do painel"}
              </span>
            </span>
            <ChevronDown
              className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-border p-2">
            <nav
              aria-label="Seções do painel"
              className="grid max-h-[60dvh] gap-1 overflow-y-auto"
            >
              {navigationLinks()}
            </nav>
            <div className="mt-2 grid gap-1 border-t border-border pt-2">
              <Link
                href="/"
                className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Store className="size-5" aria-hidden="true" /> Ver loja
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
                >
                  <LogOut className="size-5" aria-hidden="true" /> Sair
                </button>
              </form>
            </div>
          </div>
        </details>
      </div>

      <div className="hidden h-full flex-col lg:flex">
        <div className="hidden items-center gap-2.5 px-6 py-5 lg:flex">
          <span className="grid size-10 place-items-center rounded-2xl gradient-brand text-white">
            <Plus className="size-5" strokeWidth={3} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-extrabold leading-tight">FarmaVida</p>
            <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              Painel Admin
            </p>
          </div>
        </div>

        {/* No desktop a sidebar é fixa: o menu rola por conta própria (min-h-0
            libera o flex-1 para encolher) e o rodapé Ver loja/Sair fica visível. */}
        <nav
          aria-label="Seções do painel"
          className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-2"
        >
          {navigationLinks()}
        </nav>

        <div className="hidden gap-1 border-t border-border p-3 lg:flex lg:flex-col">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Store className="size-5" aria-hidden="true" /> Ver loja
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-danger-500/10 hover:text-danger-500"
            >
              <LogOut className="size-5" aria-hidden="true" /> Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
