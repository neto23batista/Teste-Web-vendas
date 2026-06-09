import { prisma } from "@/lib/prisma";

export function getUserOrders(userId: string, take?: number) {
  return prisma.order.findMany({
    where: { userId },
    include: {
      items: { include: { product: { select: { emoji: true, slug: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export type UserOrder = Awaited<ReturnType<typeof getUserOrders>>[number];

export async function getAccountSummary(userId: string) {
  const [ordersCount, inProgress, loyalty, prescriptions] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.count({
      where: { userId, status: { in: ["PENDING", "PAID", "PREPARING", "SHIPPED"] } },
    }),
    prisma.loyaltyAccount.findUnique({ where: { userId } }),
    prisma.prescription.count({ where: { userId } }),
  ]);
  return {
    ordersCount,
    inProgress,
    points: loyalty?.points ?? 0,
    prescriptions,
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

export function getUserPrescriptions(userId: string) {
  return prisma.prescription.findMany({
    where: { userId },
    include: { order: { select: { number: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function getUserWithAddresses(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: { orderBy: { isDefault: "desc" } } },
  });
}
