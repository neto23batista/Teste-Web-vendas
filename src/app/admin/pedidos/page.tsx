import Link from "next/link";
import { ChevronRight, Download, Search } from "lucide-react";
import { getAdminOrders } from "@/lib/admin";
import { getCurrentUser } from "@/lib/session";
import { effectiveProfile } from "@/lib/permissions";
import { formatBRL, cn } from "@/lib/utils";
import { StatusBadge, STATUS_META } from "@/components/store/order-status";
import { Pagination } from "@/components/admin/pagination";
import { AutoRefresh } from "@/components/auto-refresh";
import { DeleteOrderButton } from "@/components/admin/delete-order-button";
import type { OrderStatus } from "@prisma/client";

type SP = Record<string, string | string[] | undefined>;
const filters: (OrderStatus | "ALL")[] = ["ALL", "PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELED"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const status = one(sp.status) as OrderStatus | undefined;
  const q = one(sp.q)?.trim() || undefined;
  const from = one(sp.from) || undefined;
  const to = one(sp.to) || undefined;
  const page = Number(one(sp.page)) || 1;
  const unit = one(sp.unit) || undefined;
  const [{ items: orders, total, pages, page: current }, user] = await Promise.all([
    getAdminOrders({ status, q, from, to }, page, unit),
    getCurrentUser(),
  ]);
  // Só o dono/gerente vê o atalho de excluir pedidos direto na lista.
  const isOwner = effectiveProfile(user?.staffProfile) === "OWNER";

  // Links das abas de status preservam busca e período.
  const statusHref = (f: OrderStatus | "ALL") => {
    const p = new URLSearchParams();
    if (f !== "ALL") p.set("status", f);
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (unit) p.set("unit", unit);
    const s = p.toString();
    return `/admin/pedidos${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* Pedidos novos entram na lista sem recarregar (preserva a busca). */}
      <AutoRefresh intervalMs={30_000} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">{total} pedidos</p>
        </div>
        <a
          href={`/api/admin/orders/export${status ? `?status=${status}` : ""}`}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-brand-300 hover:bg-muted"
        >
          <Download className="size-4" /> Exportar CSV
        </a>
      </div>

      <form
        action="/admin/pedidos"
        method="get"
        className="space-y-2 lg:flex lg:flex-wrap lg:items-center lg:gap-2 lg:space-y-0"
      >
        {status && <input type="hidden" name="status" value={status} />}
        {unit && <input type="hidden" name="unit" value={unit} />}
        <div className="relative lg:min-w-56 lg:max-w-md lg:flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Nº do pedido, cliente ou e-mail…"
            className="h-12 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-sm outline-none focus:border-brand-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            De
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-12 w-full min-w-0 rounded-2xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-brand-400"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            Até
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-12 w-full min-w-0 rounded-2xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-brand-400"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="h-12 flex-1 rounded-2xl border border-border bg-card px-5 text-sm font-semibold transition hover:border-brand-300 hover:bg-muted lg:flex-none"
          >
            Filtrar
          </button>
          {(q || from || to) && (
            <Link
              href={status ? `/admin/pedidos?status=${status}` : "/admin/pedidos"}
              className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {filters.map((f) => {
          const active = (f === "ALL" && !status) || f === status;
          return (
            <Link
              key={f}
              href={statusHref(f)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                active ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-card hover:border-brand-300"
              )}
            >
              {f === "ALL" ? "Todos" : STATUS_META[f].label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Mobile: lista em cards (a tabela não cabe na tela). */}
        <div className="divide-y divide-border md:hidden">
          {orders.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum pedido encontrado.
            </p>
          )}
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/pedidos/${o.id}`}
              className="flex items-center justify-between gap-3 p-4 transition active:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="font-semibold">{o.number}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {o.user.name} ·{" "}
                  {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                </p>
                <div className="mt-1.5">
                  <StatusBadge status={o.status} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-bold tabular-nums">{formatBRL(o.total)}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 font-semibold">Pedido</th>
                <th className="p-4 font-semibold">Cliente</th>
                <th className="p-4 font-semibold">Data</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Total</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="transition hover:bg-muted/30">
                  <td className="p-4 font-semibold">
                    <Link href={`/admin/pedidos/${o.id}`} className="hover:text-brand-600">
                      {o.number}
                    </Link>
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{o.user.name}</p>
                    <p className="text-xs text-muted-foreground">{o.user.email}</p>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="p-4 font-bold">{formatBRL(o.total)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      {isOwner && (
                        <DeleteOrderButton
                          orderId={o.id}
                          orderNumber={o.number}
                          compact
                        />
                      )}
                      <Link
                        href={`/admin/pedidos/${o.id}`}
                        aria-label={`Abrir pedido ${o.number}`}
                        className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-brand-600"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={current}
        pages={pages}
        baseParams={{ status: status ?? undefined, q, from, to, unit }}
      />
    </div>
  );
}
