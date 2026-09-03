"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy } from "@/lib/auth/session";
import { logAuditInTransaction } from "@/lib/audit";
import { moneyToCents } from "@/lib/money";
import { reportError } from "@/lib/monitoring";
import { cancelOrder, confirmStripePayment } from "@/lib/orders";

export type PaymentActionResult = { ok: boolean; error?: string; warning?: string };

/**
 * Conciliação de cobrança em quarentena.
 *
 * Uma cobrança entra em quarentena quando o provedor informou valor ou moeda
 * diferente do total do pedido — o dinheiro pode estar retido lá. Nada de
 * automático mexe nela de propósito, então estas duas ações são o único caminho
 * de saída, e as duas são idempotentes: repetir não duplica efeito.
 */

async function loadQuarantined(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      pharmacyId: true,
      payment: {
        select: { id: true, status: true, externalId: true, provider: true },
      },
    },
  });
  if (!order) return { error: "Pedido não encontrado." as const };
  await requireAdminAtPharmacy(order.pharmacyId);
  if (order.payment?.status !== "QUARANTINED") {
    return { error: "Esta cobrança não está em quarentena." as const };
  }
  return { order };
}

/**
 * Reconsulta o provedor. Se o valor e a moeda agora batem com o total do pedido
 * — o caso real é captura parcial que se completou depois —, confirma o pedido
 * pelo caminho normal. Caso contrário mantém a quarentena e atualiza o
 * diagnóstico: reconsultar nunca é a ação que libera dinheiro por engano.
 */
export async function recheckQuarantinedPayment(
  orderId: string,
): Promise<PaymentActionResult> {
  const actor = await assertArea("financeiro");
  const loaded = await loadQuarantined(orderId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const { order } = loaded;

  if (!order.payment?.externalId) {
    return {
      ok: false,
      error:
        "Sem PaymentIntent registrado. Localize a cobrança no painel do Stripe e resolva por lá.",
    };
  }

  const expectedCents = moneyToCents(order.total);
  if (expectedCents === null) {
    return { ok: false, error: "O total do pedido está inválido." };
  }

  let provider;
  try {
    const { getPaymentStatus } = await import("@/lib/payments/stripe");
    provider = await getPaymentStatus(order.payment.externalId);
  } catch (error) {
    reportError(error, { operation: "payment.quarantine.recheck" });
    return { ok: false, error: "Não foi possível consultar o provedor agora." };
  }
  if (!provider) {
    return { ok: false, error: "O provedor não devolveu esta cobrança." };
  }

  const matches =
    provider.referenceId === order.number &&
    provider.amountCents === expectedCents &&
    provider.currency.toLowerCase() === "brl";

  if (!matches || !provider.paid) {
    await prisma.payment.updateMany({
      where: { id: order.payment.id, status: "QUARANTINED" },
      data: {
        lastReconciledAt: new Date(),
        reconciliationAttempts: { increment: 1 },
        reconciliationError:
          `Reconsulta em ${new Date().toISOString()}: ${provider.amountCents} ${provider.currency.toUpperCase()} (${provider.status}); esperado ${expectedCents} BRL.`.slice(
            0,
            2000,
          ),
      },
    });
    return {
      ok: false,
      error: matches
        ? "O provedor ainda não confirma o pagamento. Mantido em quarentena."
        : "O valor continua divergente. Mantido em quarentena — estorne se não for cobrar este pedido.",
    };
  }

  // Volta ao caminho normal: `confirmStripePayment` já é idempotente e só age
  // uma vez, mesmo se o webhook chegar em paralelo.
  await prisma.payment.updateMany({
    where: { id: order.payment.id, status: "QUARANTINED" },
    data: { status: "PENDING", failureReason: null, reconciliationError: null },
  });
  await confirmStripePayment(order.id, provider.paidChargeId ?? order.payment.externalId);

  await prisma.$transaction(async (tx) => {
    await logAuditInTransaction(tx, {
      action: "payment.quarantine.release",
      entity: "Payment",
      entityId: order.payment!.id,
      pharmacyId: order.pharmacyId ?? undefined,
      detail: `Conciliou a cobrança divergente do pedido ${order.number} após reconsulta no provedor`,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
  });

  revalidatePath("/admin/financeiro");
  revalidatePath(`/admin/pedidos/${order.id}`);
  return { ok: true };
}

/**
 * Devolve o valor ao cliente e encerra o pedido. `cancelOrder` já leva o
 * pagamento a REFUND_PENDING e dispara o estorno; se o provedor demorar, a
 * reconciliação de reembolsos termina o trabalho.
 */
export async function refundQuarantinedPayment(
  orderId: string,
): Promise<PaymentActionResult> {
  const actor = await assertArea("financeiro");
  const loaded = await loadQuarantined(orderId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const { order } = loaded;

  // `cancelOrder` só reembolsa o que enxerga como aprovado. A cobrança
  // divergente nunca chegou a APPROVED, então o estorno é pedido explicitamente
  // aqui — e o pagamento sai da quarentena para o fluxo normal de reembolso.
  await prisma.payment.updateMany({
    where: { id: order.payment!.id, status: "QUARANTINED" },
    data: { status: "APPROVED" },
  });

  let canceled;
  try {
    canceled = await cancelOrder(order.id, {
      paymentFailureReason: "Cobrança divergente devolvida ao cliente.",
    });
  } catch (error) {
    // Devolve à quarentena: sem isso o pagamento ficaria APPROVED sem pedido
    // cancelado, que é pior do que o estado de onde ele saiu.
    await prisma.payment.updateMany({
      where: { id: order.payment!.id, status: "APPROVED" },
      data: { status: "QUARANTINED" },
    });
    reportError(error, { operation: "payment.quarantine.refund" });
    return { ok: false, error: "Não foi possível estornar agora. Tente novamente." };
  }

  await prisma.$transaction(async (tx) => {
    await logAuditInTransaction(tx, {
      action: "payment.quarantine.refund",
      entity: "Payment",
      entityId: order.payment!.id,
      pharmacyId: order.pharmacyId ?? undefined,
      detail: `Estornou a cobrança divergente do pedido ${order.number}`,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
  });

  revalidatePath("/admin/financeiro");
  revalidatePath(`/admin/pedidos/${order.id}`);

  const status = canceled?.payment?.status;
  if (status === "REFUND_FAILED") {
    return {
      ok: true,
      warning:
        "Pedido cancelado, mas o provedor recusou o estorno. Reprocesse pelo pedido.",
    };
  }
  if (status === "REFUND_PENDING") {
    return { ok: true, warning: "Estorno em processamento no provedor." };
  }
  return { ok: true };
}
