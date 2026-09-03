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
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: { select: { status: true } } },
  });
  if (!order || order.status !== "PENDING") return order;
  // Cobrança em quarentena tem valor possivelmente retido no provedor. Cancelar
  // por um evento de falha posterior devolveria o estoque e encerraria o pedido
  // enquanto o dinheiro segue lá — a decisão é da conciliação, não do webhook.
  if (order.payment?.status === "QUARANTINED") return order;
  return cancelOrder(orderId, {
    paymentFailureReason: reason,
    skipProviderAction: true,
  });
}

export type PaymentQuarantineInput = {
  orderId: string;
  paymentIntentId: string | null;
  paidCents: number | null;
  expectedCents: number;
  currency: string | null;
};

const asMoney = (cents: number | null) =>
  cents === null ? "?" : (cents / 100).toFixed(2);

/**
 * Retira a cobrança de todo automatismo e a coloca na fila de conciliação.
 *
 * Divergência de valor ou moeda significa que NÃO podemos confirmar o pedido —
 * mas o dinheiro pode ter sido capturado no provedor. Concluir o evento sem
 * deixar rastro (o comportamento anterior) perdia o vínculo com o PaymentIntent
 * e ainda deixava o pedido ser expirado pelo cron de reservas, devolvendo o
 * estoque como se nada tivesse sido cobrado.
 *
 * Guarda o PaymentIntent, registra a divergência para o operador e marca
 * `QUARANTINED` — estado que a reconciliação e o expirador de reservas ignoram
 * de propósito. Não mexe em pagamento que já entrou em fluxo de reembolso: ali
 * alguém já decidiu.
 */
export async function quarantinePayment(input: PaymentQuarantineInput) {
  const detail = `Recebido ${asMoney(input.paidCents)} ${(input.currency ?? "?").toUpperCase()}; esperado ${asMoney(input.expectedCents)} BRL.`;
  const claimed = await prisma.payment.updateMany({
    where: {
      orderId: input.orderId,
      status: { notIn: ["REFUND_PENDING", "REFUND_FAILED", "REFUNDED"] },
    },
    data: {
      ...(input.paymentIntentId ? { externalId: input.paymentIntentId } : {}),
      status: "QUARANTINED",
      failureReason:
        "Valor ou moeda divergem do total do pedido. Conferência manual necessária.",
      reconciliationError: detail.slice(0, 2000),
      lastReconciledAt: new Date(),
    },
  });
  return claimed.count === 1;
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
