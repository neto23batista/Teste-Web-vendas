import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Assinaturas de reposição recorrente — SEM cobrança automática.
 * No vencimento, o cron (/api/cron/subscriptions) lembra o cliente por e-mail;
 * o "Repor agora" coloca o item na sacola e o cliente conclui o pedido normal.
 */
// Leituras resilientes: até a migration `subscriptions` rodar em produção a
// tabela pode não existir — nesse caso, comporta-se como "sem assinaturas".

export async function getUserSubscriptions(userId: string) {
  return prisma.subscription
    .findMany({
      where: { userId },
      orderBy: { nextDueAt: "asc" },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            emoji: true,
            price: true,
            promoPrice: true,
            active: true,
            requiresPrescription: true,
            images: { orderBy: { sort: "asc" }, take: 1, select: { url: true } },
          },
        },
      },
    })
    .catch(() => []);
}

/** Assinatura do usuário para um produto (para o estado do botão na PDP). */
export async function getUserSubscriptionFor(userId: string, productId: string) {
  return prisma.subscription
    .findFirst({
      where: {
        userId,
        productId,
        product: { active: true, requiresPrescription: false },
      },
      select: { id: true, status: true, intervalDays: true, qty: true },
    })
    .catch(() => null);
}

/** Lista completa para o admin (matriz). */
export async function listAllSubscriptions() {
  return prisma.subscription
    .findMany({
      orderBy: { nextDueAt: "asc" },
      take: 300,
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true, emoji: true } },
      },
    })
    .catch(() => []);
}
