import { prisma } from "@/lib/prisma";
import { getAdminScope } from "@/lib/session";
import type { Prisma, OrderStatus } from "@prisma/client";

const PAID_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

/**
 * Filtro efetivo de unidade para as queries do admin:
 *  - Filial: sempre a própria unidade (ignora a seleção da URL).
 *  - Matriz (global): a unidade selecionada, ou null = todas as unidades.
 */
export async function resolveUnitFilter(
  selectedUnitId?: string | null
): Promise<string | null> {
  const scope = await getAdminScope();
  if (!scope.isGlobal) return scope.pharmacyId;
  return selectedUnitId ?? null;
}

/** Variação percentual (arredondada) entre dois períodos. null quando não há
 *  base de comparação (período anterior zerado) — aí o card não mostra delta. */
function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function getAdminStats(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const orderUnit: Prisma.OrderWhereInput = unit ? { pharmacyId: unit } : {};

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
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count({ where: { active: true } }),
    prisma.inventory.count({
      // "Baixo" = abaixo do mínimo configurado no item (igual à página de
      // Estoque); unidades desativadas não contam.
      where: {
        stock: { lte: prisma.inventory.fields.minStock },
        product: { active: true },
        pharmacy: { active: true },
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
    buckets.set(key, (buckets.get(key) ?? 0) + o.total);
  }
  return Array.from(buckets.entries()).map(([date, total]) => ({
    date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    total: Math.round(total * 100) / 100,
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

export async function getRecentOrders(take = 6, selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  return prisma.order.findMany({
    where: unit ? { pharmacyId: unit } : undefined,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export const ADMIN_PER_PAGE = 20;

export async function getAdminProducts(
  q?: string,
  page = 1,
  selectedUnitId?: string | null
) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { ean: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const current = Math.max(1, page);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        inventory: {
          where: unit ? { pharmacyId: unit } : undefined,
          select: { stock: true, minStock: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * ADMIN_PER_PAGE,
      take: ADMIN_PER_PAGE,
    }),
    prisma.product.count({ where }),
  ]);
  // Achata o estoque da unidade (ou soma de todas) para a tabela.
  const items = rows.map(({ inventory, ...p }) => ({
    ...p,
    stock: inventory.reduce((s, i) => s + i.stock, 0),
    minStock: inventory[0]?.minStock ?? 5,
  }));
  return {
    items,
    total,
    page: current,
    perPage: ADMIN_PER_PAGE,
    pages: Math.max(1, Math.ceil(total / ADMIN_PER_PAGE)),
  };
}

/** Linhas de estoque por unidade para a página de Controle de estoque. */
export async function getStockRows(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  // Sem unidade definida (matriz "todas"), usa a matriz como referência para
  // ajuste — o ajuste sempre age sobre UMA unidade concreta.
  const targetUnit =
    unit ??
    (await prisma.pharmacy.findFirst({ where: { type: "MATRIZ" }, select: { id: true } }))?.id ??
    null;
  if (!targetUnit) return { unitId: null, rows: [] as StockRow[] };

  const rows = await prisma.inventory.findMany({
    where: { pharmacyId: targetUnit, product: { active: true } },
    select: {
      stock: true,
      minStock: true,
      product: {
        select: { id: true, name: true, emoji: true, category: { select: { name: true } } },
      },
    },
    orderBy: { stock: "asc" },
    take: 200,
  });
  return {
    unitId: targetUnit,
    rows: rows.map((r) => ({
      productId: r.product.id,
      name: r.product.name,
      emoji: r.product.emoji,
      category: r.product.category.name,
      stock: r.stock,
      minStock: r.minStock,
    })),
  };
}

export type StockRow = {
  productId: string;
  name: string;
  emoji: string | null;
  category: string;
  stock: number;
  minStock: number;
};

export type AdminOrderFilters = {
  status?: OrderStatus;
  /** Busca por número do pedido, nome ou e-mail do cliente. */
  q?: string;
  /** Datas no formato yyyy-mm-dd (input type="date"). */
  from?: string;
  to?: string;
};

export async function getAdminOrders(
  filters: AdminOrderFilters = {},
  page = 1,
  selectedUnitId?: string | null
) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const where: Prisma.OrderWhereInput = {};
  if (unit) where.pharmacyId = unit;
  if (filters.status) where.status = filters.status;
  if (filters.q) {
    where.OR = [
      { number: { contains: filters.q, mode: "insensitive" } },
      { user: { name: { contains: filters.q, mode: "insensitive" } } },
      { user: { email: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.from) {
    const d = new Date(`${filters.from}T00:00:00`);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (filters.to) {
    const d = new Date(`${filters.to}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) createdAt.lte = d;
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
  // Conta primeiro para clampar a página ao teto real: excluir o último pedido
  // de uma página deixaria o admin numa ?page fora de faixa (tabela vazia).
  const total = await prisma.order.count({ where });
  const pages = Math.max(1, Math.ceil(total / ADMIN_PER_PAGE));
  const current = Math.min(Math.max(1, page), pages);
  const items = await prisma.order.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      pharmacy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * ADMIN_PER_PAGE,
    take: ADMIN_PER_PAGE,
  });
  return { items, total, page: current, perPage: ADMIN_PER_PAGE, pages };
}

export async function getAdminCustomers(q?: string, page = 1) {
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { cpf: { contains: q, mode: "insensitive" } },
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

/** Pedido para a tela de detalhe. Filial só acessa pedidos da própria unidade. */
export async function getAdminOrder(id: string) {
  const scope = await getAdminScope();
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      address: true,
      pharmacy: { select: { id: true, name: true, type: true } },
      items: { include: { product: { select: { emoji: true } } } },
      payment: true,
    },
  });
  if (!order) return null;
  // Filial não enxerga pedido de outra unidade.
  if (!scope.isGlobal && order.pharmacyId && order.pharmacyId !== scope.pharmacyId) {
    return null;
  }
  return order;
}

/** Contadores que viram badges de atenção na sidebar do admin. */
export async function getAdminBadges(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const orderUnit: Prisma.OrderWhereInput = unit ? { pharmacyId: unit } : {};
  const [ordersToProcess, lowStock, pendingReviews] =
    await Promise.all([
      prisma.order.count({ where: { status: { in: ["PAID", "PREPARING"] }, ...orderUnit } }),
      prisma.inventory.count({
        where: {
          stock: { lte: prisma.inventory.fields.minStock },
          product: { active: true },
          pharmacy: { active: true },
          ...(unit ? { pharmacyId: unit } : {}),
        },
      }),
      prisma.review.count({ where: { approved: false } }),
    ]);
  return { ordersToProcess, lowStock, pendingReviews };
}

/** Avaliações para moderação: pendentes em fila (mais antiga primeiro);
 *  aprovadas em ordem inversa, limitadas às 100 mais recentes. */
export function getReviewsByApproval(approved: boolean) {
  return prisma.review.findMany({
    where: { approved },
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: approved ? "desc" : "asc" },
    ...(approved ? { take: 100 } : {}),
  });
}


export function getCategoriesAndBrands() {
  return Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
}
