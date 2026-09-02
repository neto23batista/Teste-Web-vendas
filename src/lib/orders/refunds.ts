import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moneyToCents as exactMoneyToCents } from "@/lib/money";

const REFUND_IN_PROGRESS: readonly PaymentStatus[] = [
  "APPROVED",
  "REFUND_PENDING",
  "REFUND_FAILED",
];

export async function processOrderRefund(orderId: string) {
  let payment = await prisma.payment.findUnique({
    where: { orderId },
    include: { order: { select: { number: true } } },
  });
  if (!payment || !REFUND_IN_PROGRESS.includes(payment.status)) return payment;

  // Pedido sem valor não movimentou dinheiro no provedor.
  if ((exactMoneyToCents(payment.amount) ?? 0) <= 0) {
    return prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        refundError: null,
        refundRequestedAt: payment.refundRequestedAt ?? new Date(),
        refundedAt: new Date(),
      },
    });
  }
  if (payment.provider !== "STRIPE") return payment;

  if (payment.status === "APPROVED" || payment.status === "REFUND_FAILED") {
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: payment.status },
      data: {
        status: "REFUND_PENDING",
        refundRequestedAt: new Date(),
        refundError: null,
      },
    });
    if (claimed.count !== 1) {
      payment = await prisma.payment.findUnique({
        where: { orderId },
        include: { order: { select: { number: true } } },
      });
      if (!payment || !REFUND_IN_PROGRESS.includes(payment.status))
        return payment;
    } else {
      payment = { ...payment, status: "REFUND_PENDING" };
    }
  }

  if (!payment.externalId) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "REFUND_PENDING" },
      data: {
        status: "REFUND_FAILED",
        refundError: "PaymentIntent ausente; requer reconciliação manual.",
      },
    });
    return prisma.payment.findUnique({ where: { id: payment.id } });
  }

  const { refundPayment } = await import("@/lib/payments/stripe");
  const result = await refundPayment(payment.externalId, payment.order.number);
  if (!result.ok) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "REFUND_PENDING" },
      data: {
        status: "REFUND_FAILED",
        refundId: result.refundId,
        refundError: result.error.slice(0, 2000),
      },
    });
    return prisma.payment.findUnique({ where: { id: payment.id } });
  }
  await prisma.payment.updateMany({
    where: { id: payment.id, status: "REFUND_PENDING" },
    data: {
      refundId: result.refundId,
      refundError: null,
      status: result.status === "succeeded" ? "REFUNDED" : "REFUND_PENDING",
      refundedAt: result.status === "succeeded" ? new Date() : null,
    },
  });
  return prisma.payment.findUnique({ where: { id: payment.id } });
}
