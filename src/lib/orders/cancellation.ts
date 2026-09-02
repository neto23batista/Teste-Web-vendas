import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moneyToCents as exactMoneyToCents } from "@/lib/money";
import { changeInventory } from "@/lib/inventory/movements";
import { releaseOrderInventoryReservations } from "@/lib/inventory/reservations";
import { processOrderRefund } from "@/lib/orders/refunds";
import {
  fallbackPharmacyId,
  claimOrderStatus,
  revalidateProductsSafe,
} from "@/lib/orders/shared";
import { assertValidInventoryItems } from "@/lib/orders/policy";

export const CANCELABLE_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "PREPARING",
];

export type CancelOrderOptions = {
  paymentFailureReason?: string;
  /** O webhook já representa o efeito no Stripe; não chama a API novamente. */
  skipProviderAction?: boolean;
};

/**
 * Cancela somente PENDING/PAID/PREPARING e reverte estoque, fidelidade e cupom
 * uma única vez. Pagamento aprovado vira REFUND_PENDING antes da chamada externa.
 */
export async function cancelOrder(
  orderId: string,
  options: CancelOrderOptions = {},
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true, loyaltyTx: true },
  });
  if (!order) return null;
  if (order.status === "CANCELED") {
    if (
      !options.skipProviderAction &&
      order.payment &&
      ["REFUND_PENDING", "REFUND_FAILED"].includes(order.payment.status)
    ) {
      await processOrderRefund(order.id);
    }
    return prisma.order.findUnique({
      where: { id: order.id },
      include: { payment: true },
    });
  }
  if (!CANCELABLE_STATUSES.includes(order.status)) {
    throw new Error(`Pedido em ${order.status} não pode ser cancelado.`);
  }

  const wasFulfilled = order.status === "PAID" || order.status === "PREPARING";
  const net = order.loyaltyTx.reduce((sum, tx) => sum + tx.points, 0);
  const paymentWasApproved = order.payment?.status === "APPROVED";
  const needsProviderRefund =
    paymentWasApproved &&
    order.payment?.provider === "STRIPE" &&
    (exactMoneyToCents(order.payment.amount) ?? 0) > 0;
  const pharmacyId = order.pharmacyId ?? (await fallbackPharmacyId());

  let didCancel = false;
  await prisma.$transaction(async (tx) => {
    didCancel = await claimOrderStatus(tx, order.id, order.status, "CANCELED");
    if (!didCancel) return;

    const releasedReservations = await releaseOrderInventoryReservations(tx, {
      orderId: order.id,
      orderNumber: order.number,
      reason: `Liberação pelo cancelamento do pedido ${order.number}`,
    });

    if (wasFulfilled && releasedReservations === 0) {
      assertValidInventoryItems(order.items);
      for (const item of order.items) {
        if (!item.productId || !pharmacyId) continue;
        await changeInventory(tx, {
          productId: item.productId,
          pharmacyId,
          delta: item.qty,
          kind: "CANCELLATION",
          reason: `Cancelamento do pedido legado ${order.number}`,
          referenceType: "ORDER",
          referenceId: order.id,
        });
      }
    }

    if (net !== 0) {
      const account = await tx.loyaltyAccount.upsert({
        where: { userId: order.userId },
        create: { userId: order.userId, points: 0 },
        update: {},
      });
      const newPoints = Math.max(0, account.points - net);
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: newPoints },
      });
      await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          points: -net,
          reason: `Estorno do pedido ${order.number}`,
          orderId: order.id,
        },
      });
    }

    if (order.couponCode) {
      const released = await tx.couponRedemption.deleteMany({
        where: { orderId: order.id },
      });
      if (released.count === 1) {
        await tx.coupon.updateMany({
          where: { code: order.couponCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }

    if (order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: needsProviderRefund
          ? {
              status: "REFUND_PENDING",
              refundRequestedAt: new Date(),
              refundError: null,
            }
          : paymentWasApproved
            ? { status: "REFUNDED", refundedAt: new Date(), refundError: null }
            : {
                status: "REJECTED",
                failureReason:
                  options.paymentFailureReason?.slice(0, 2000) ||
                  "Pedido cancelado.",
                failedAt: new Date(),
              },
      });
    }
  });

  if (!didCancel) {
    return prisma.order.findUnique({
      where: { id: order.id },
      include: { payment: true },
    });
  }

  if (!options.skipProviderAction && needsProviderRefund) {
    await processOrderRefund(order.id);
  } else if (
    !options.skipProviderAction &&
    !paymentWasApproved &&
    order.payment?.provider === "STRIPE"
  ) {
    const { cancelPendingStripePayment, readCheckoutRaw } =
      await import("@/lib/payments/stripe");
    const checkout = readCheckoutRaw(order.payment.raw);
    await cancelPendingStripePayment({
      paymentIntentId: order.payment.externalId,
      checkoutSessionId: checkout?.sessionId,
    });
  }

  revalidateProductsSafe();
  return prisma.order.findUnique({
    where: { id: order.id },
    include: { payment: true },
  });
}
