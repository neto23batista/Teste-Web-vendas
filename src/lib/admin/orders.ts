import { prisma } from "@/lib/prisma";
import { getAdminScope } from "@/lib/auth/session";
import type { Prisma, OrderStatus } from "@prisma/client";
import { moneyToNumber } from "@/lib/money";
import { resolveUnitFilter, ADMIN_PER_PAGE } from "@/lib/admin/scope";

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
  selectedUnitId?: string | null,
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

/** Pedido para a tela de detalhe. Filial só acessa pedidos da própria unidade. */
export async function getAdminOrder(id: string) {
  const scope = await getAdminScope();
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      pharmacy: { select: { id: true, name: true, type: true } },
      items: { include: { product: { select: { emoji: true } } } },
      payment: true,
      deliveryProof: true,
      returnRequests: {
        include: {
          items: {
            include: { orderItem: { select: { name: true, productId: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
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
    returnRequests: order.returnRequests.map((request) => ({
      ...request,
      requestedAmount: moneyToNumber(request.requestedAmount),
      approvedAmount:
        request.approvedAmount == null
          ? null
          : moneyToNumber(request.approvedAmount),
    })),
    payment: order.payment
      ? { ...order.payment, amount: moneyToNumber(order.payment.amount) }
      : null,
  };
}
