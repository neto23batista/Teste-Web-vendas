import Link from "next/link";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Boxes,
  Receipt,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  getAdminStats,
  getSalesByDay,
  getOrdersByStatus,
  getTopProducts,
  getRecentOrders,
} from "@/lib/admin";
import { formatBRL } from "@/lib/utils";
import { StatusBadge } from "@/components/store/order-status";
import { SalesAreaChart, TopProductsBar, StatusDonut } from "@/components/admin/charts";

export default async function AdminDashboard() {
  const [stats, sales, byStatus, topProducts, recent] = await Promise.all([
    getAdminStats(),
    getSalesByDay(14),
    getOrdersByStatus(),
    getTopProducts(5),
    getRecentOrders(6),
  ]);

  const cards = [
    { icon: DollarSign, label: "Receita", value: formatBRL(stats.revenue), delta: stats.deltas.revenue, accent: "bg-success-500/10 text-success-600" },
    { icon: ShoppingCart, label: "Pedidos", value: stats.ordersCount, delta: stats.deltas.orders, accent: "bg-brand-100 text-brand-600 dark:bg-brand-600/20 dark:text-brand-300" },
    { icon: Receipt, label: "Ticket médio", value: formatBRL(stats.avgTicket), delta: stats.deltas.avgTicket, accent: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300" },
    { icon: Users, label: "Clientes", value: stats.customersCount, delta: stats.deltas.customers, accent: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300" },
    { icon: Boxes, label: "Produtos ativos", value: stats.productsCount, delta: null, accent: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da operação</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map(({ icon: Icon, label, value, delta, accent }) => {
          const up = delta != null && delta >= 0;
          return (
            <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <span className={`grid size-11 place-items-center rounded-xl ${accent}`}>
                  <Icon className="size-5" />
                </span>
                {delta != null && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
                      up
                        ? "bg-success-500/10 text-success-600"
                        : "bg-danger-500/10 text-danger-500"
                    }`}
                    title="Últimos 30 dias vs. 30 dias anteriores"
                  >
                    {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {up ? "+" : ""}
                    {delta}%
                  </span>
                )}
              </div>
              <p className="mt-3 text-2xl font-extrabold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          );
        })}
      </div>

      {stats.lowStock > 0 && (
        <Link
          href="/admin/estoque"
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle className="size-5" />
          {stats.lowStock} {stats.lowStock === 1 ? "produto" : "produtos"} com
          estoque baixo — revisar reposição
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold">Vendas (últimos 14 dias)</h2>
          <SalesAreaChart data={sales} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-bold">Pedidos por status</h2>
          <StatusDonut data={byStatus} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-bold">Produtos mais vendidos</h2>
          {topProducts.length > 0 ? (
            <TopProductsBar data={topProducts} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Sem vendas registradas ainda.
            </p>
          )}
        </div>

        {/* Pedidos recentes */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Pedidos recentes</h2>
            <Link
              href="/admin/pedidos"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Ver todos <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/admin/pedidos/${o.id}`}
                className="flex items-center justify-between gap-3 py-3 transition hover:opacity-80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{o.number}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.user.name}</p>
                </div>
                <StatusBadge status={o.status} />
                <span className="text-sm font-bold">{formatBRL(o.total)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
