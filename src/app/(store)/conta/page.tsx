import Link from "next/link";
import type { Metadata } from "next";
import { Gift, Package, Clock, ArrowRight, ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getAccountSummary, getUserOrders } from "@/lib/account";
import { OrderCard } from "@/components/account/order-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountHome() {
  const user = await requireUser();
  const [summary, orders] = await Promise.all([
    getAccountSummary(user.id),
    getUserOrders(user.id, 3),
  ]);

  const stats = [
    { icon: Gift, label: "Pontos de fidelidade", value: summary.points, href: "/conta/fidelidade", accent: "text-violet-600 bg-violet-100 dark:bg-violet-500/20 dark:text-violet-300" },
    { icon: Package, label: "Pedidos realizados", value: summary.ordersCount, href: "/conta/pedidos", accent: "text-brand-600 bg-brand-100 dark:bg-brand-600/20 dark:text-brand-300" },
    { icon: Clock, label: "Em andamento", value: summary.inProgress, href: "/conta/pedidos", accent: "text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value, href, accent }) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
          >
            <span className={`grid size-11 place-items-center rounded-xl ${accent}`}>
              <Icon className="size-5" />
            </span>
            <p className="mt-3 text-3xl font-extrabold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </Link>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Pedidos recentes</h2>
          <Link
            href="/conta/pedidos"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Ver todos <ArrowRight className="size-4" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
              <ShoppingBag className="size-7" />
            </span>
            <p className="font-semibold">Você ainda não fez pedidos</p>
            <Button asChild variant="primary">
              <Link href="/catalogo">Começar a comprar</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
