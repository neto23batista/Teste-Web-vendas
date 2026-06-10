import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { StatusBadge } from "@/components/store/order-status";
import { ReorderButton } from "@/components/store/reorder-button";
import type { UserOrder } from "@/lib/account";

export function OrderCard({ order }: { order: UserOrder }) {
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
  return (
    // Link "esticado" cobre o card; os botões de ação ficam acima (z-10).
    <article className="group relative rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <Link
        href={`/pedido/${order.number}`}
        aria-label={`Ver pedido ${order.number}`}
        className="absolute inset-0 rounded-2xl"
      />

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

      <div className="relative z-10 mt-4 flex items-center gap-2">
        <ReorderButton
          orderNumber={order.number}
          variant="soft"
          size="sm"
          className="flex-1"
        />
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100 dark:text-brand-400">
          Detalhes <ArrowRight className="size-4" />
        </span>
      </div>
    </article>
  );
}
