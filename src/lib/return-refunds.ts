import { prisma } from "@/lib/prisma";
import { moneyToCents } from "@/lib/money";

export type ReturnRefundResult = {
  ok: boolean;
  pending?: boolean;
  error?: string;
};

export type StripeReturnRefundUpdate = {
  refundId: string;
  returnId?: string | null;
  status: string | null;
  amountCents: number;
  error?: string | null;
};

/**
 * Liquida financeiramente uma devolução já recebida. O claim persistido vem
 * antes da API externa, e a chave idempotente é estável por solicitação.
 */
export async function settleReturnRefund(returnId: string): Promise<ReturnRefundResult> {
  const request = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: {
      order: {
        include: {
          payment: true,
          returnRequests: {
            where: { id: { not: returnId }, refundStatus: { in: ["PROCESSING", "SUCCEEDED"] } },
            select: { approvedAmount: true },
          },
        },
      },
    },
  });
  if (!request) return { ok: false, error: "Solicitação não encontrada." };
  if (request.refundStatus === "SUCCEEDED" && request.status === "COMPLETED") {
    return { ok: true };
  }
  if (request.status !== "RECEIVED") {
    return { ok: false, error: "A devolução precisa estar fisicamente recebida." };
  }

  const approvedCents =
    request.approvedAmount == null ? null : moneyToCents(request.approvedAmount);
  if (approvedCents === null) {
    return { ok: false, error: "A devolução não possui valor aprovado válido." };
  }
  const payment = request.order.payment;

  // Dinheiro/valor zero é liquidado operacionalmente; não existe chamada a um
  // provedor para fazer. A mesma transição continua idempotente.
  if (approvedCents === 0 || !payment || payment.provider !== "STRIPE") {
    const completed = await prisma.returnRequest.updateMany({
      where: {
        id: request.id,
        status: "RECEIVED",
        refundStatus: { in: ["PENDING", "FAILED", "PROCESSING"] },
      },
      data: {
        status: "COMPLETED",
        refundStatus: "SUCCEEDED",
        refundError: null,
        refundedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return completed.count === 1 ? { ok: true } : { ok: false, error: "A devolução mudou." };
  }

  if (!payment.externalId || payment.status !== "APPROVED") {
    await prisma.returnRequest.updateMany({
      where: { id: request.id, status: "RECEIVED" },
      data: {
        refundStatus: "FAILED",
        refundError: "Pagamento Stripe não está aprovado ou não possui PaymentIntent.",
      },
    });
    return { ok: false, error: "Pagamento Stripe sem dados válidos para reembolso." };
  }

  const paidCents = moneyToCents(payment.amount);
  const alreadyCommitted = request.order.returnRequests.reduce(
    (sum, item) =>
      sum + (item.approvedAmount == null ? 0 : (moneyToCents(item.approvedAmount) ?? 0)),
    0
  );
  if (paidCents === null || approvedCents > paidCents - alreadyCommitted) {
    await prisma.returnRequest.updateMany({
      where: { id: request.id, status: "RECEIVED" },
      data: {
        refundStatus: "FAILED",
        refundError: "Valor aprovado ultrapassa o saldo ainda reembolsável do pagamento.",
      },
    });
    return { ok: false, error: "O valor aprovado ultrapassa o saldo reembolsável." };
  }

  const claimed = await prisma.returnRequest.updateMany({
    where: {
      id: request.id,
      status: "RECEIVED",
      refundStatus: { in: ["PENDING", "FAILED"] },
    },
    data: { refundStatus: "PROCESSING", refundError: null },
  });
  if (claimed.count !== 1) {
    const current = await prisma.returnRequest.findUnique({
      where: { id: request.id },
      select: { refundStatus: true },
    });
    return current?.refundStatus === "SUCCEEDED"
      ? { ok: true }
      : { ok: true, pending: true };
  }

  const { refundPayment } = await import("@/lib/stripe");
  const result = await refundPayment(payment.externalId, request.order.number, {
    amountCents: approvedCents,
    returnId: request.id,
    idempotencyKey: `return-refund-${request.id}`,
  });
  if (!result.ok) {
    await prisma.returnRequest.updateMany({
      where: { id: request.id, refundStatus: "PROCESSING" },
      data: {
        refundStatus: "FAILED",
        refundId: result.refundId,
        refundError: result.error.slice(0, 2000),
      },
    });
    return { ok: false, error: result.error };
  }

  await prisma.returnRequest.updateMany({
    where: { id: request.id, refundStatus: "PROCESSING" },
    data: {
      refundId: result.refundId,
      refundStatus: result.status === "succeeded" ? "SUCCEEDED" : "PROCESSING",
      refundError: null,
      ...(result.status === "succeeded"
        ? { status: "COMPLETED", refundedAt: new Date(), completedAt: new Date() }
        : {}),
    },
  });
  return result.status === "succeeded" ? { ok: true } : { ok: true, pending: true };
}

/** Reconcilia refund.* sem alterar o status global do pagamento original. */
export async function recordStripeReturnRefund(update: StripeReturnRefundUpdate) {
  const request = await prisma.returnRequest.findFirst({
    where: {
      OR: [
        { refundId: update.refundId },
        ...(update.returnId ? [{ id: update.returnId }] : []),
      ],
    },
    select: { id: true, approvedAmount: true, refundStatus: true },
  });
  if (!request) return null;

  const expectedCents =
    request.approvedAmount == null ? null : moneyToCents(request.approvedAmount);
  const amountMatches = expectedCents !== null && expectedCents === update.amountCents;
  const succeeded = update.status === "succeeded" && amountMatches;
  const failed =
    update.status === "failed" ||
    update.status === "canceled" ||
    (update.status === "succeeded" && !amountMatches);

  await prisma.returnRequest.updateMany({
    where: {
      id: request.id,
      ...(request.refundStatus === "SUCCEEDED" && !succeeded
        ? { refundStatus: { not: "SUCCEEDED" } }
        : {}),
    },
    data: {
      refundId: update.refundId,
      refundStatus: succeeded ? "SUCCEEDED" : failed ? "FAILED" : "PROCESSING",
      refundError: succeeded
        ? null
        : !amountMatches
          ? "O valor do reembolso diverge do valor aprovado."
          : update.error?.slice(0, 2000) || null,
      ...(succeeded
        ? { status: "COMPLETED", refundedAt: new Date(), completedAt: new Date() }
        : {}),
    },
  });
  return prisma.returnRequest.findUnique({ where: { id: request.id } });
}
