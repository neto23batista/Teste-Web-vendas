import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { centsToNumber, moneyToCents, moneyToNumber } from "@/lib/money";
import { resolveUnitFilter } from "@/lib/admin/scope";

const PAID_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

/** Variação percentual (arredondada) entre dois períodos. null quando não há
 *  base de comparação (período anterior zerado) — aí o card não mostra delta. */
function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function getAdminStats(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const orderUnit: Prisma.OrderWhereInput = unit ? { pharmacyId: unit } : {};
  const customerUnit: Prisma.UserWhereInput = unit
    ? { orders: { some: { pharmacyId: unit } } }
    : {};

  const now = new Date();
  const d30 = new Date(now);
  d30.setDate(now.getDate() - 30);
  const d60 = new Date(now);
  d60.setDate(now.getDate() - 60);

  const [
    revenueAgg,
    paidCount,
    ordersCount,
    customersCount,
    productsCount,
    lowStock,
    paidOrders60,
    newCust30,
    newCust3060,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: [...PAID_STATUSES] }, ...orderUnit },
    }),
    prisma.order.count({
      where: { status: { in: [...PAID_STATUSES] }, ...orderUnit },
    }),
    prisma.order.count({ where: orderUnit }),
    prisma.user.count({ where: { role: "CUSTOMER", ...customerUnit } }),
    prisma.product.count({ where: { active: true } }),
    prisma.inventory.count({
      // "Baixo" = abaixo do mínimo configurado no item (igual à página de
      // Estoque); unidades desativadas não contam.
      where: {
        stock: { lte: prisma.inventory.fields.minStock },
        product: { active: true },
        pharmacy: { active: true, archivedAt: null },
        ...(unit ? { pharmacyId: unit } : {}),
      },
    }),
    prisma.order.findMany({
      where: {
        status: { in: [...PAID_STATUSES] },
        createdAt: { gte: d60 },
        ...orderUnit,
      },
      select: { total: true, createdAt: true },
    }),
    prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: d30 }, ...customerUnit },
    }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: d60, lt: d30 },
        ...customerUnit,
      },
    }),
  ]);

  // Particiona os pedidos pagos dos últimos 60 dias em duas janelas de 30 dias.
  let rev30Cents = 0;
  let rev3060Cents = 0;
  let ord30 = 0;
  let ord3060 = 0;
  for (const o of paidOrders60) {
    if (o.createdAt >= d30) {
      rev30Cents += moneyToCents(o.total) ?? 0;
      ord30++;
    } else {
      rev3060Cents += moneyToCents(o.total) ?? 0;
      ord3060++;
    }
  }

  const revenueCents = revenueAgg._sum.total
    ? (moneyToCents(revenueAgg._sum.total) ?? 0)
    : 0;
  const revenue = centsToNumber(revenueCents);
  const avgTicket =
    paidCount > 0 ? centsToNumber(Math.round(revenueCents / paidCount)) : 0;
  const avg30 = ord30 > 0 ? centsToNumber(Math.round(rev30Cents / ord30)) : 0;
  const avg3060 =
    ord3060 > 0 ? centsToNumber(Math.round(rev3060Cents / ord3060)) : 0;

  return {
    revenue,
    ordersCount,
    customersCount,
    productsCount,
    lowStock,
    avgTicket,
    // Variação dos últimos 30 dias vs. os 30 dias anteriores.
    deltas: {
      revenue: pctChange(rev30Cents, rev3060Cents),
      orders: pctChange(ord30, ord3060),
      customers: pctChange(newCust30, newCust3060),
      avgTicket: pctChange(avg30, avg3060),
    },
  };
}

export async function getSalesByDay(days = 14, selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: [...PAID_STATUSES] },
      ...(unit ? { pharmacyId: unit } : {}),
    },
    select: { total: true, createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + (moneyToCents(o.total) ?? 0));
  }
  return Array.from(buckets.entries()).map(([date, total]) => ({
    date: new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    total: centsToNumber(total),
  }));
}

export async function getOrdersByStatus(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const grouped = await prisma.order.groupBy({
    by: ["status"],
    where: unit ? { pharmacyId: unit } : undefined,
    _count: { _all: true },
  });
  return grouped.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function getTopProducts(take = 5, selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const grouped = await prisma.orderItem.groupBy({
    by: ["name"],
    where: unit ? { order: { pharmacyId: unit } } : undefined,
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take,
  });
  return grouped.map((g) => ({ name: g.name, qty: g._sum.qty ?? 0 }));
}

export async function getRecentOrders(
  take = 6,
  selectedUnitId?: string | null,
) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const rows = await prisma.order.findMany({
    where: { archivedAt: null, ...(unit ? { pharmacyId: unit } : {}) },
    select: {
      id: true,
      number: true,
      customerName: true,
      status: true,
      total: true,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => ({ ...row, total: moneyToNumber(row.total) }));
}

/** Contadores que viram badges de atenção na sidebar do admin. */
export async function getAdminBadges(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const orderUnit: Prisma.OrderWhereInput = unit ? { pharmacyId: unit } : {};
  const [ordersToProcess, lowStock, pendingReviews] = await Promise.all([
    prisma.order.count({
      where: {
        archivedAt: null,
        status: { in: ["PAID", "PREPARING"] },
        ...orderUnit,
      },
    }),
    prisma.inventory.count({
      where: {
        stock: { lte: prisma.inventory.fields.minStock },
        product: { active: true },
        pharmacy: { active: true, archivedAt: null },
        ...(unit ? { pharmacyId: unit } : {}),
      },
    }),
    prisma.review.count({ where: { approved: false } }),
  ]);
  return { ordersToProcess, lowStock, pendingReviews };
}
