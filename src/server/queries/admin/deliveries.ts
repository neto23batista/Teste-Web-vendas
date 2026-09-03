import "server-only";

import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/auth/session";
import { resolveUnitFilter } from "@/lib/admin";
import { listPharmaciesSafe } from "@/lib/pharmacy";
import { moneyToNumber } from "@/lib/money";

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

export async function getAdminDeliveriesView(selectedUnitId?: string) {
  await requireArea("entregas");
  const unit = await resolveUnitFilter(selectedUnitId);
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

  const toOrder = (o: (typeof prontos)[number]) => ({
    id: o.id,
    number: o.number,
    total: moneyToNumber(o.total),
    status: o.status,
    courierName: o.courier?.name ?? null,
    address: fmtAddress(o),
    dispatchedAt: fmtTime(o.dispatchedAt),
  });

  const courierRows = couriers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    active: c.active,
    pharmacyName: c.pharmacy?.name ?? null,
  }));

  return {
    prontos: prontos.map(toOrder), emRota: emRota.map(toOrder),
    couriers: courierRows,
    pharmacies: pharmacies.map(({ id, name }) => ({ id, name })),
  };
}
