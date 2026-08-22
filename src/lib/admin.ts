import { prisma } from "@/lib/prisma";
import { assertArea, getAdminScope, type AdminScope } from "@/lib/session";
import type { Prisma, OrderStatus } from "@prisma/client";
import { centsToNumber, moneyToCents, moneyToNumber } from "@/lib/money";

const PAID_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

/**
 * Um cliente pertence ao escopo operacional de uma filial somente quando há
 * pelo menos um pedido atendido por ela. A matriz não recebe filtro e mantém a
 * visão global. O caso sem pharmacyId falha fechado, mesmo que hoje o guard de
 * sessão já rejeite administradores sem unidade ativa.
 */
function customerScopeWhere(scope: AdminScope): Prisma.UserWhereInput {
  if (scope.isGlobal) return {};
  if (!scope.pharmacyId) return { id: { equals: "__unscoped_admin__" } };
  return { orders: { some: { pharmacyId: scope.pharmacyId } } };
}

function customerOrderScopeWhere(
  scope: AdminScope
): Prisma.OrderWhereInput | undefined {
  if (scope.isGlobal) return undefined;
  return scope.pharmacyId
    ? { pharmacyId: scope.pharmacyId }
    : { id: { equals: "__unscoped_admin__" } };
}

function customerAddressScopeWhere(
  scope: AdminScope
): Prisma.AddressWhereInput | undefined {
  const orderWhere = customerOrderScopeWhere(scope);
  return orderWhere ? { orders: { some: orderWhere } } : undefined;
}

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
    ? moneyToCents(revenueAgg._sum.total) ?? 0
    : 0;
  const revenue = centsToNumber(revenueCents);
  const avgTicket = paidCount > 0 ? centsToNumber(Math.round(revenueCents / paidCount)) : 0;
  const avg30 = ord30 > 0 ? centsToNumber(Math.round(rev30Cents / ord30)) : 0;
  const avg3060 = ord3060 > 0 ? centsToNumber(Math.round(rev3060Cents / ord3060)) : 0;

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
    date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
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

export async function getRecentOrders(take = 6, selectedUnitId?: string | null) {
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
    price: moneyToNumber(p.price),
    promoPrice: p.promoPrice == null ? null : moneyToNumber(p.promoPrice),
    costPrice: p.costPrice == null ? null : moneyToNumber(p.costPrice),
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
    (await prisma.pharmacy.findFirst({
      where: { type: "MATRIZ", archivedAt: null },
      select: { id: true },
    }))?.id ??
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
  /** true mostra somente o arquivo; por padrão a fila operacional fica limpa. */
  archived?: boolean;
};

export async function getAdminOrders(
  filters: AdminOrderFilters = {},
  page = 1,
  selectedUnitId?: string | null
) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const where: Prisma.OrderWhereInput = {
    archivedAt: filters.archived ? { not: null } : null,
  };
  if (unit) where.pharmacyId = unit;
  if (filters.status) where.status = filters.status;
  if (filters.q) {
    where.OR = [
      { number: { contains: filters.q, mode: "insensitive" } },
      { customerName: { contains: filters.q, mode: "insensitive" } },
      { customerEmail: { contains: filters.q, mode: "insensitive" } },
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
      pharmacy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * ADMIN_PER_PAGE,
    take: ADMIN_PER_PAGE,
  });
  return {
    items: items.map((item) => ({ ...item, total: moneyToNumber(item.total) })),
    total,
    page: current,
    perPage: ADMIN_PER_PAGE,
    pages,
  };
}

export async function getAdminCustomers(q?: string, page = 1) {
  await assertArea("clientes");
  const scope = await getAdminScope();
  const orderWhere = customerOrderScopeWhere(scope);
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...customerScopeWhere(scope),
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
        createdAt: true,
        _count: {
          select: {
            orders: orderWhere ? { where: orderWhere } : true,
          },
        },
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

export async function getAdminCustomer(id: string) {
  await assertArea("clientes");
  const scope = await getAdminScope();
  const orderWhere = customerOrderScopeWhere(scope);
  const addressWhere = customerAddressScopeWhere(scope);
  const customer = await prisma.user.findFirst({
    where: {
      id,
      role: "CUSTOMER",
      ...customerScopeWhere(scope),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      createdAt: true,
      loyalty: { select: { points: true } },
      addresses: {
        ...(addressWhere ? { where: addressWhere } : {}),
        orderBy: { isDefault: "desc" },
      },
      orders: {
        ...(orderWhere ? { where: orderWhere } : {}),
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
  return customer
    ? {
        ...customer,
        orders: customer.orders.map((order) => ({
          ...order,
          total: moneyToNumber(order.total),
        })),
      }
    : null;
}

/** Pedido para a tela de detalhe. Filial só acessa pedidos da própria unidade. */
export async function getAdminOrder(id: string) {
  const scope = await getAdminScope();
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      pharmacy: { select: { id: true, name: true, type: true } },
      items: { include: { product: { select: { emoji: true } } } },
      payment: true,
    },
  });
  if (!order) return null;
  // Filial não enxerga pedido de outra unidade.
  if (!scope.isGlobal && order.pharmacyId !== scope.pharmacyId) {
    return null;
  }
  return {
    ...order,
    subtotal: moneyToNumber(order.subtotal),
    discount: moneyToNumber(order.discount),
    shipping: moneyToNumber(order.shipping),
    total: moneyToNumber(order.total),
    items: order.items.map((item) => ({
      ...item,
      price: moneyToNumber(item.price),
    })),
    payment: order.payment
      ? { ...order.payment, amount: moneyToNumber(order.payment.amount) }
      : null,
  };
}

/** Contadores que viram badges de atenção na sidebar do admin. */
export async function getAdminBadges(selectedUnitId?: string | null) {
  const unit = await resolveUnitFilter(selectedUnitId);
  const orderUnit: Prisma.OrderWhereInput = unit ? { pharmacyId: unit } : {};
  const [ordersToProcess, lowStock, pendingReviews] =
    await Promise.all([
      prisma.order.count({
        where: { archivedAt: null, status: { in: ["PAID", "PREPARING"] }, ...orderUnit },
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

/** Avaliações para moderação: pendentes em fila (mais antiga primeiro);
 *  aprovadas em ordem inversa, limitadas às 100 mais recentes. */
export async function getReviewsByApproval(approved: boolean) {
  await assertArea("avaliacoes");
  return prisma.review.findMany({
    where: { approved },
    include: {
      // O e-mail não é usado na moderação e não deve ser carregado.
      user: { select: { name: true } },
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
