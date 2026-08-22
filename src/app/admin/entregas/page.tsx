import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/session";
import { resolveUnitFilter } from "@/lib/admin";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  DeliveryBoard,
  type CourierRow,
  type DeliveryOrder,
} from "@/components/admin/delivery-board";
import { moneyToNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Entregas" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const fmtAddress = (a: {
  shippingStreet: string;
  shippingNumber: string;
  shippingDistrict: string;
  shippingCity: string;
}) =>
  `${a.shippingStreet}, ${a.shippingNumber} · ${a.shippingDistrict}, ${a.shippingCity}`;

const fmtTime = (d: Date | null) =>
  d
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireArea("entregas");
  const sp = await searchParams;
  const unit = await resolveUnitFilter(one(sp.unit) || undefined);
  const orderUnit = unit ? { pharmacyId: unit } : {};

  const [prontos, emRota, couriers, pharmacies] = await Promise.all([
    prisma.order.findMany({
      where: { archivedAt: null, status: { in: ["PAID", "PREPARING"] }, ...orderUnit },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        shippingStreet: true,
        shippingNumber: true,
        shippingDistrict: true,
        shippingCity: true,
        courier: { select: { name: true } },
        dispatchedAt: true,
      },
    }),
    prisma.order.findMany({
      where: { archivedAt: null, status: "SHIPPED", ...orderUnit },
      orderBy: { dispatchedAt: "asc" },
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        shippingStreet: true,
        shippingNumber: true,
        shippingDistrict: true,
        shippingCity: true,
        courier: { select: { name: true } },
        dispatchedAt: true,
      },
    }),
    // Entregadores da unidade selecionada + os "gerais" (sem unidade).
    prisma.courier.findMany({
      where: unit ? { OR: [{ pharmacyId: unit }, { pharmacyId: null }] } : {},
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        active: true,
        pharmacy: { select: { name: true } },
      },
    }),
    listPharmaciesSafe(),
  ]);

  const toOrder = (o: (typeof prontos)[number]): DeliveryOrder => ({
    id: o.id,
    number: o.number,
    total: moneyToNumber(o.total),
    status: o.status,
    courierName: o.courier?.name ?? null,
    address: fmtAddress(o),
    dispatchedAt: fmtTime(o.dispatchedAt),
  });

  const courierRows: CourierRow[] = couriers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    active: c.active,
    pharmacyName: c.pharmacy?.name ?? null,
  }));

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

      <DeliveryBoard
        prontos={prontos.map(toOrder)}
        emRota={emRota.map(toOrder)}
        couriers={courierRows}
        pharmacies={pharmacies.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
