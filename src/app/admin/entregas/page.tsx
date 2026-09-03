import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { getAdminDeliveriesView } from "@/server/queries/admin/deliveries";
import { AutoRefresh } from "@/components/auto-refresh";
import { DeliveryBoard } from "@/components/admin/deliveries/delivery-board";

export const metadata: Metadata = { title: "Entregas" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const view = await getAdminDeliveriesView(one(sp.unit) || undefined);

  return (
    <div className="space-y-6">
      {/* Pedidos pagos entram no quadro sem recarregar a página. */}
      <AutoRefresh intervalMs={30_000} />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Truck className="size-6 text-brand-600 dark:text-brand-400" /> Entregas
        </h1>
        <p className="text-sm text-muted-foreground">
          Despache pedidos pagos com um entregador e confirme quando chegarem. O
          cliente acompanha as atualizações de status na página do pedido.
        </p>
      </div>

      <DeliveryBoard {...view} />
    </div>
  );
}
