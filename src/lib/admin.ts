import { prisma } from "@/lib/prisma";
import type { Prisma, OrderStatus } from "@prisma/client";

const PAID_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

/** Variação percentual (arredondada) entre dois períodos. null quando não há
 *  base de comparação (período anterior zerado) — aí o card não mostra delta. */
function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function getAdminStats() {
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
      where: { status: { in: [...PAID_STATUSES] } },
    }),
    prisma.order.count({ where: { status: { in: [...PAID_STATUSES] } } }),
    prisma.order.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true, stock: { lte: 5 } } }),
    prisma.order.findMany({
      where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: d60 } },
      select: { total: true, createdAt: true },
    }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: d30 } } }),
    prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: d60, lt: d30 } },
    }),
  ]);

  // Particiona os pedidos pagos dos últimos 60 dias em duas janelas de 30 dias.
  let rev30 = 0;
  let rev3060 = 0;
  let ord30 = 0;
  let ord3060 = 0;
  for (const o of paidOrders60) {
    if (o.createdAt >= d30) {
      rev30 += o.total;
      ord30++;
    } else {
      rev3060 += o.total;
      ord3060++;
    }
  }

  const revenue = revenueAgg._sum.total ?? 0;
  const avgTicket = paidCount > 0 ? revenue / paidCount : 0;
  const avg30 = ord30 > 0 ? rev30 / ord30 : 0;
  const avg3060 = ord3060 > 0 ? rev3060 / ord3060 : 0;

  return {
    revenue,
    ordersCount,
    customersCount,
    productsCount,
    lowStock,
    avgTicket,
    // Variação dos últimos 30 dias vs. os 30 dias anteriores.
    deltas: {
      revenue: pctChange(rev30, rev3060),
      orders: pctChange(ord30, ord3060),
      customers: pctChange(newCust30, newCust3060),
      avgTicket: pctChange(avg30, avg3060),
    },
  };
}

export async function getSalesByDay(days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { in: [...PAID_STATUSES] } },
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
    buckets.set(key, (buckets.get(key) ?? 0) + o.total);
  }
  return Array.from(buckets.entries()).map(([date, total]) => ({
    date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    total: Math.round(total * 100) / 100,
  }));
}

export async function getOrdersByStatus() {
  const grouped = await prisma.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return grouped.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function getTopProducts(take = 5) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["name"],
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take,
  });
  return grouped.map((g) => ({ name: g.name, qty: g._sum.qty ?? 0 }));
}

export function getRecentOrders(take = 6) {
  return prisma.order.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export const ADMIN_PER_PAGE = 20;

export async function getAdminProducts(q?: string, page = 1) {
  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { name: { contains: q } },
          { sku: { contains: q } },
          { ean: { contains: q } },
        ],
      }
    : {};
  const current = Math.max(1, page);
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * ADMIN_PER_PAGE,
      take: ADMIN_PER_PAGE,
    }),
    prisma.product.count({ where }),
  ]);
  return {
    items,
    total,
    page: current,
    perPage: ADMIN_PER_PAGE,
    pages: Math.max(1, Math.ceil(total / ADMIN_PER_PAGE)),
  };
}

export async function getAdminOrders(status?: OrderStatus, page = 1) {
  const where: Prisma.OrderWhereInput = status ? { status } : {};
  const current = Math.max(1, page);
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * ADMIN_PER_PAGE,
      take: ADMIN_PER_PAGE,
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items,
    total,
    page: current,
    perPage: ADMIN_PER_PAGE,
    pages: Math.max(1, Math.ceil(total / ADMIN_PER_PAGE)),
  };
}

export async function getAdminCustomers(q?: string, page = 1) {
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { cpf: { contains: q } },
          ],
        }
      : {}),
  };
  const current = Math.max(1, page);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        createdAt: true,
        _count: { select: { orders: true } },
        loyalty: { select: { points: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * ADMIN_PER_PAGE,
      take: ADMIN_PER_PAGE,
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items,
    total,
    page: current,
    perPage: ADMIN_PER_PAGE,
    pages: Math.max(1, Math.ceil(total / ADMIN_PER_PAGE)),
  };
}

export function getAdminCustomer(id: string) {
  return prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      createdAt: true,
      loyalty: { select: { points: true } },
      addresses: { orderBy: { isDefault: "desc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
    },
  });
}

export function getAdminOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      address: true,
      items: { include: { product: { select: { emoji: true } } } },
      payment: true,
      prescriptions: true,
    },
  });
}

/** Contadores que viram badges de atenção na sidebar do admin. */
export async function getAdminBadges() {
  const [pendingPrescriptions, ordersToProcess, lowStock] = await Promise.all([
    prisma.prescription.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: { in: ["PAID", "PREPARING"] } } }),
    prisma.product.count({ where: { active: true, stock: { lte: 5 } } }),
  ]);
  return { pendingPrescriptions, ordersToProcess, lowStock };
}

export function getPendingPrescriptions() {
  return prisma.prescription.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { name: true, email: true } },
      order: { select: { id: true, number: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function getCategoriesAndBrands() {
  return Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
}
