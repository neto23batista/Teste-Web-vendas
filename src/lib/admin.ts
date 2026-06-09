import { prisma } from "@/lib/prisma";
import type { Prisma, OrderStatus } from "@prisma/client";

const PAID_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

export async function getAdminStats() {
  const [revenueAgg, ordersCount, customersCount, productsCount, lowStock] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { in: [...PAID_STATUSES] } },
      }),
      prisma.order.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.product.count({ where: { active: true } }),
      prisma.product.count({ where: { active: true, stock: { lte: 5 } } }),
    ]);

  return {
    revenue: revenueAgg._sum.total ?? 0,
    ordersCount,
    customersCount,
    productsCount,
    lowStock,
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
