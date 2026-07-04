import { prisma } from "@/lib/prisma";

/**
 * Assinaturas de reposição recorrente — SEM cobrança automática.
 * No vencimento, o cron (/api/cron/subscriptions) lembra o cliente por e-mail;
 * o "Repor agora" coloca o item na sacola e o cliente conclui o pedido normal.
 * Produtos com receita ficam de fora (validação farmacêutica a cada compra).
 */
export const SUBSCRIPTION_INTERVALS = [30, 60, 90] as const;

export function isValidInterval(days: number): boolean {
  return (SUBSCRIPTION_INTERVALS as readonly number[]).includes(days);
}

export function intervalLabel(days: number): string {
  if (days === 30) return "Mensal";
  if (days === 60) return "A cada 2 meses";
  if (days === 90) return "A cada 3 meses";
  return `A cada ${days} dias`;
}

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
    .findUnique({
      where: { userId_productId: { userId, productId } },
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
