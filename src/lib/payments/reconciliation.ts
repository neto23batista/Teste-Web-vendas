import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/monitoring";
import { moneyToCents } from "@/lib/money";
import {
  cancelOrder,
  confirmStripePayment,
  failStripePayment,
  processOrderRefund,
  recordStripeRefund,
} from "@/lib/orders";
import { recordStripeReturnRefund, settleReturnRefund } from "@/lib/payments/return-refunds";
import {
  getCheckoutPaymentStatus,
  getPaymentStatus,
  getRefundStatus,
  readCheckoutRaw,
} from "@/lib/payments/stripe";

export type PaymentReconciliationSummary = {
  checkedPayments: number;
  confirmedPayments: number;
  failedPayments: number;
  checkedRefunds: number;
  checkedReturnRefunds: number;
  expiredOrders: number;
  errors: number;
  /** O que ficou para a próxima execução. Ver `measureBacklog`. */
  backlog: ReconciliationBacklog;
};

export type ReconciliationBacklog = {
  pendingPayments: number;
  expiredReservations: number;
  pendingRefunds: number;
  /** Idade do item mais velho da fila, em minutos. `null` = fila vazia. */
  oldestPendingPaymentMinutes: number | null;
  oldestExpiredReservationMinutes: number | null;
};

/**
 * A reserva segura estoque por 25 h. Se um item continua na fila mais de uma
 * hora depois de vencer, a execução não está dando conta do volume — estoque
 * fica bloqueado além do prometido e o cliente vê "sem estoque" sem motivo.
 * É o sinal para aumentar a frequência ou o lote, e por isso vira alerta.
 */
const BACKLOG_SLA_MS = 60 * 60 * 1000;

const minutesSince = (date: Date | null | undefined, now: Date): number | null =>
  date ? Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000)) : null;

/**
 * Mede o que sobrou depois da passada. Sem isso, uma fila crescendo em silêncio
 * só aparecia quando um cliente reclamava: o resumo do job dizia quantos itens
 * foram tratados, nunca quantos ficaram.
 */
async function measureBacklog(now: Date): Promise<ReconciliationBacklog> {
  const [pendingPayments, oldestPending, expired, oldestExpired, pendingRefunds] =
    await Promise.all([
      prisma.payment.count({
        where: { provider: "STRIPE", status: "PENDING", order: { status: "PENDING" } },
      }),
      prisma.payment.findFirst({
        where: { provider: "STRIPE", status: "PENDING", order: { status: "PENDING" } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.inventoryReservation.count({
        where: { status: "ACTIVE", expiresAt: { lte: now } },
      }),
      prisma.inventoryReservation.findFirst({
        where: { status: "ACTIVE", expiresAt: { lte: now } },
        orderBy: { expiresAt: "asc" },
        select: { expiresAt: true },
      }),
      prisma.payment.count({
        where: {
          provider: "STRIPE",
          status: { in: ["REFUND_PENDING", "REFUND_FAILED"] },
        },
      }),
    ]);

  const backlog: ReconciliationBacklog = {
    pendingPayments,
    expiredReservations: expired,
    pendingRefunds,
    oldestPendingPaymentMinutes: minutesSince(oldestPending?.createdAt, now),
    oldestExpiredReservationMinutes: minutesSince(oldestExpired?.expiresAt, now),
  };

  const overdue =
    (backlog.oldestExpiredReservationMinutes ?? 0) * 60_000 > BACKLOG_SLA_MS;
  if (overdue) {
    reportError(
      new Error("Fila de reconciliação acima do SLA; estoque bloqueado além do prazo."),
      {
        operation: "payments.reconcile.backlog",
        expiredReservations: String(backlog.expiredReservations),
        oldestExpiredMinutes: String(backlog.oldestExpiredReservationMinutes),
        pendingRefunds: String(backlog.pendingRefunds),
      },
    );
  }

  return backlog;
}

/**
 * Rede de segurança para webhook perdido e reserva vencida. Cada transição final
 * continua idempotente no banco; o job pode ser repetido sem duplicar efeitos.
 */
export async function reconcilePaymentsAndReservations(
  limit = 50
): Promise<PaymentReconciliationSummary> {
  const summary: PaymentReconciliationSummary = {
    checkedPayments: 0,
    confirmedPayments: 0,
    failedPayments: 0,
    checkedRefunds: 0,
    checkedReturnRefunds: 0,
    expiredOrders: 0,
    errors: 0,
    backlog: {
      pendingPayments: 0,
      expiredReservations: 0,
      pendingRefunds: 0,
      oldestPendingPaymentMinutes: null,
      oldestExpiredReservationMinutes: null,
    },
  };
  const now = new Date();

  const pendingPayments = await prisma.payment.findMany({
    where: {
      provider: "STRIPE",
      status: "PENDING",
      createdAt: { lte: new Date(now.getTime() - 2 * 60 * 1000) },
      order: { status: "PENDING" },
    },
    include: { order: { select: { id: true, number: true, total: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const payment of pendingPayments) {
    summary.checkedPayments += 1;
    try {
      const checkout = readCheckoutRaw(payment.raw);
      const provider = payment.externalId
        ? await getPaymentStatus(payment.externalId)
        : checkout?.sessionId
          ? await getCheckoutPaymentStatus(checkout.sessionId)
          : null;
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          lastReconciledAt: now,
          reconciliationAttempts: { increment: 1 },
          reconciliationError: provider ? null : "Cobrança ainda não consultável no Stripe.",
        },
      });
      if (!provider) {
        summary.errors += 1;
        continue;
      }

      const expectedCents = moneyToCents(payment.order.total);
      if (
        expectedCents === null ||
        provider.referenceId !== payment.order.number ||
        provider.amountCents !== expectedCents ||
        provider.currency.toLowerCase() !== "brl"
      ) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { reconciliationError: "Referência, moeda ou valor diverge do pedido." },
        });
        summary.errors += 1;
        continue;
      }
      if (provider.paid && provider.paidChargeId) {
        await confirmStripePayment(payment.order.id, provider.paidChargeId);
        summary.confirmedPayments += 1;
      } else if (provider.status === "canceled") {
        await failStripePayment(
          payment.order.id,
          payment.externalId,
          "Cobrança cancelada no Stripe."
        );
        summary.failedPayments += 1;
      }
    } catch (error) {
      summary.errors += 1;
      await prisma.payment.updateMany({
        where: { id: payment.id },
        data: {
          lastReconciledAt: now,
          reconciliationAttempts: { increment: 1 },
          reconciliationError: (error instanceof Error ? error.message : "Falha de reconciliação.").slice(0, 2000),
        },
      });
    }
  }

  // Só expira depois de consultar o provedor: uma cobrança paga cujo webhook
  // se perdeu é confirmada acima e deixa de satisfazer order.status=PENDING.
  const expired = await prisma.inventoryReservation.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
      order: {
        status: "PENDING",
        // Pedido com cobrança em quarentena fica de fora: pode haver dinheiro
        // retido no provedor, e expirar aqui devolveria o estoque e encerraria o
        // pedido enquanto o valor segue lá. Quem decide é a conciliação.
        OR: [
          { payment: { is: null } },
          { payment: { status: { not: "QUARANTINED" } } },
        ],
      },
    },
    distinct: ["orderId"],
    take: limit,
    select: { orderId: true },
  });
  for (const item of expired) {
    try {
      const canceled = await cancelOrder(item.orderId, {
        paymentFailureReason: "Prazo da reserva de estoque expirado.",
      });
      if (canceled?.status === "CANCELED") summary.expiredOrders += 1;
    } catch {
      summary.errors += 1;
    }
  }

  const refunds = await prisma.payment.findMany({
    where: {
      provider: "STRIPE",
      status: { in: ["REFUND_PENDING", "REFUND_FAILED"] },
      updatedAt: { lte: new Date(now.getTime() - 2 * 60 * 1000) },
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
  for (const payment of refunds) {
    summary.checkedRefunds += 1;
    try {
      if (payment.refundId) {
        const provider = await getRefundStatus(payment.refundId);
        if (provider) await recordStripeRefund(provider);
      } else {
        await processOrderRefund(payment.orderId);
      }
      await prisma.payment.updateMany({
        where: { id: payment.id },
        data: {
          lastReconciledAt: now,
          reconciliationAttempts: { increment: 1 },
          reconciliationError: null,
        },
      });
    } catch (error) {
      summary.errors += 1;
      await prisma.payment.updateMany({
        where: { id: payment.id },
        data: {
          lastReconciledAt: now,
          reconciliationAttempts: { increment: 1 },
          reconciliationError: (error instanceof Error ? error.message : "Falha ao reconciliar reembolso.").slice(0, 2000),
        },
      });
    }
  }

  const returnRefunds = await prisma.returnRequest.findMany({
    where: {
      status: "RECEIVED",
      refundStatus: { in: ["PROCESSING", "FAILED"] },
      updatedAt: { lte: new Date(now.getTime() - 2 * 60 * 1000) },
    },
    select: { id: true, refundId: true },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  for (const request of returnRefunds) {
    summary.checkedReturnRefunds += 1;
    try {
      if (request.refundId) {
        const provider = await getRefundStatus(request.refundId);
        if (provider) {
          await recordStripeReturnRefund({ ...provider, returnId: request.id });
        }
      } else {
        await settleReturnRefund(request.id);
      }
    } catch {
      summary.errors += 1;
    }
  }

  // Medido no fim, sobre o estado já tratado: o que aparece aqui é o que a
  // próxima execução vai encontrar.
  summary.backlog = await measureBacklog(new Date());
  return summary;
}
