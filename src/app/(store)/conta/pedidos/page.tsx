import Link from "next/link";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getUserOrders } from "@/lib/account";
import { OrderCard } from "@/components/account/order-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getUserOrders(user.id);

  return (
    <div className="space-y-5">
      {/* Status dos pedidos se atualiza sozinho (admin avança → cliente vê). */}
      <AutoRefresh intervalMs={30_000} />
      <h2 className="text-lg font-bold">Meus pedidos</h2>
      {orders.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300">
            <Package className="size-7" />
          </span>
          <p className="font-semibold">Nenhum pedido por aqui ainda</p>
          <Button asChild variant="primary">
            <Link href="/catalogo">Ir às compras</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
