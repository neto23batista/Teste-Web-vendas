import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moneyToCents as exactMoneyToCents } from "@/lib/money";
import { processOrderRefund } from "@/lib/orders/refunds";
import { fulfillOrder } from "@/lib/orders/fulfillment";
import { cancelOrder, CANCELABLE_STATUSES } from "@/lib/orders/cancellation";

/** Confirma o pagamento; se o pedido já foi cancelado, estorna automaticamente. */
export async function confirmStripePayment(
  orderId: string,
  paymentIntentId: string,
) {
  await prisma.payment.updateMany({
    where: { orderId, provider: "STRIPE" },
    data: { externalId: paymentIntentId, failureReason: null, failedAt: null },
  });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  if (order.status === "CANCELED") {
    await prisma.payment.updateMany({
      where: {
        orderId,
        status: { in: ["PENDING", "REJECTED", "APPROVED"] },
      },
      data: { status: "REFUND_PENDING", refundRequestedAt: new Date() },
    });
    await processOrderRefund(orderId);
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
  }
  if (order.status === "PENDING") return fulfillOrder(orderId);

  await prisma.payment.updateMany({
    where: { orderId, status: { in: ["PENDING", "REJECTED"] } },
    data: { status: "APPROVED" },
  });
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
}

/** Rejeita e cancela apenas se o pedido ainda aguarda este pagamento. */
export async function failStripePayment(
  orderId: string,
  paymentIntentId: string | null,
  reason: string,
) {
  if (paymentIntentId) {
    await prisma.payment.updateMany({
      where: { orderId, provider: "STRIPE" },
      data: { externalId: paymentIntentId },
    });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING") return order;
  return cancelOrder(orderId, {
    paymentFailureReason: reason,
    skipProviderAction: true,
  });
}

export type StripeRefundUpdate = {
  refundId: string;
  paymentIntentId: string | null;
  status: string | null;
  amountCents: number;
  error?: string | null;
};

/** Reconcilia eventos refund.* inclusive quando o estorno nasceu no Dashboard. */
export async function recordStripeRefund(update: StripeRefundUpdate) {
  const payment = await prisma.payment.findFirst({
    where: {
      provider: "STRIPE",
      OR: [
        { refundId: update.refundId },
        ...(update.paymentIntentId
          ? [{ externalId: update.paymentIntentId }]
          : []),
      ],
    },
    include: { order: { select: { id: true, status: true } } },
  });
  if (!payment) return null;

  const fullRefund = update.amountCents === exactMoneyToCents(payment.amount);
  if (
    update.status === "succeeded" &&
    fullRefund &&
    payment.order.status !== "CANCELED" &&
    CANCELABLE_STATUSES.includes(payment.order.status)
  ) {
    await cancelOrder(payment.order.id, { skipProviderAction: true });
  }

  const failed = update.status === "failed" || update.status === "canceled";
  const succeeded = update.status === "succeeded" && fullRefund;
  const nextStatus: PaymentStatus = succeeded
    ? "REFUNDED"
    : failed || (update.status === "succeeded" && !fullRefund)
      ? "REFUND_FAILED"
      : "REFUND_PENDING";
  await prisma.payment.updateMany({
    where: {
      id: payment.id,
      // Evento "created/pending" atrasado nunca rebaixa um reembolso concluído.
      status: succeeded
        ? {
            in: [
              "PENDING",
              "APPROVED",
              "REJECTED",
              "REFUND_PENDING",
              "REFUND_FAILED",
              "REFUNDED",
            ],
          }
        : { not: "REFUNDED" },
    },
    data: {
      refundId: update.refundId,
      status: nextStatus,
      refundError: succeeded
        ? null
        : !fullRefund
          ? "Reembolso parcial requer reconciliação manual."
          : update.error?.slice(0, 2000) || null,
      refundRequestedAt: payment.refundRequestedAt ?? new Date(),
      refundedAt: succeeded ? new Date() : null,
    },
  });
  return prisma.payment.findUnique({ where: { id: payment.id } });
}
