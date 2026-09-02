import { prisma } from "@/lib/prisma";
import { moneyToNumber } from "@/lib/money";

export async function getUserOrders(userId: string, take?: number) {
  const now = Date.now();
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: { include: { product: { select: { emoji: true, slug: true } } } },
      returnRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          requestedAt: true,
          approvedAmount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return orders.map((order) => ({
    ...order,
    subtotal: moneyToNumber(order.subtotal),
    discount: moneyToNumber(order.discount),
    shipping: moneyToNumber(order.shipping),
    total: moneyToNumber(order.total),
    canRequestReturn:
      order.status === "DELIVERED" &&
      order.deliveredAt !== null &&
      now <= order.deliveredAt.getTime() + 7 * 86_400_000,
    items: order.items.map((item) => ({
      ...item,
      price: moneyToNumber(item.price),
    })),
    returnRequests: order.returnRequests.map((request) => ({
      ...request,
      approvedAmount:
        request.approvedAmount == null ? null : moneyToNumber(request.approvedAmount),
    })),
  }));
}

export type UserOrder = Awaited<ReturnType<typeof getUserOrders>>[number];

export async function getAccountSummary(userId: string) {
  const [ordersCount, inProgress, loyalty] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.count({
      where: { userId, status: { in: ["PENDING", "PAID", "PREPARING", "SHIPPED"] } },
    }),
    prisma.loyaltyAccount.findUnique({ where: { userId } }),
  ]);
  return {
    ordersCount,
    inProgress,
    points: loyalty?.points ?? 0,
  };
}

export function getLoyalty(userId: string) {
  return prisma.loyaltyAccount.findUnique({
    where: { userId },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
}

export function getUserWithAddresses(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: { orderBy: { isDefault: "desc" } } },
  });
}
