import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { getAdminOrders } from "@/lib/admin";
import { formatBRL, cn } from "@/lib/utils";
import { StatusBadge, STATUS_META } from "@/components/store/order-status";
import { Pagination } from "@/components/admin/pagination";
import type { OrderStatus } from "@prisma/client";

type SP = Record<string, string | string[] | undefined>;
const filters: (OrderStatus | "ALL")[] = ["ALL", "PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELED"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const status = (Array.isArray(sp.status) ? sp.status[0] : sp.status) as OrderStatus | undefined;
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1;
  const { items: orders, total, pages, page: current } = await getAdminOrders(status, page);

  return (
    <div className="space-y-6">
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

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {filters.map((f) => {
          const active = (f === "ALL" && !status) || f === status;
          return (
            <Link
              key={f}
              href={f === "ALL" ? "/admin/pedidos" : `/admin/pedidos?status=${f}`}
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
        <div className="overflow-x-auto">
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
                  <td className="p-4 text-right">
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-brand-600"
                    >
                      <ChevronRight className="size-4" />
                    </Link>
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
        baseParams={{ status: status ?? undefined }}
      />
    </div>
  );
}
