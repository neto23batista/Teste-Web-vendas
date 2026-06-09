import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { StatusBadge } from "@/components/store/order-status";
import type { UserOrder } from "@/lib/account";

export function OrderCard({ order }: { order: UserOrder }) {
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
  return (
    <Link
      href={`/pedido/${order.number}`}
      className="group block rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">Pedido {order.number}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex -space-x-2">
          {order.items.slice(0, 4).map((it) => (
            <span
              key={it.id}
              className="grid size-9 place-items-center rounded-xl border border-border bg-muted text-lg"
              title={it.name}
            >
              {it.product?.emoji ?? "💊"}
            </span>
          ))}
          {order.items.length > 4 && (
            <span className="grid size-9 place-items-center rounded-xl border border-border bg-muted text-xs font-bold">
              +{order.items.length - 4}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </p>
          <p className="font-extrabold text-brand-700 dark:text-brand-400">
            {formatBRL(order.total)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100 dark:text-brand-400">
        Ver detalhes <ArrowRight className="size-4" />
      </div>
    </Link>
  );
}
