"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy, assertOwner } from "@/lib/auth/session";
import { sendMail, baseUrl } from "@/lib/communications/mail";
import { notifyUnit } from "@/lib/communications/notifications";
import { orderStatusEmail, orderIncomingTransferEmail } from "@/lib/communications/email-templates";
import {
  ORDER_STATUSES,
  cancelOrder,
  transferOrder,
  fulfillOrder,
  isValidOrderTransition,
  processOrderRefund,
  transitionOrderStatus,
  TRANSFERABLE_STATUSES,
} from "@/lib/orders";
import { logAudit, logAuditInTransaction } from "@/lib/audit";
import type { OrderStatus } from "@prisma/client";

// A lista de estados transferíveis vive no domínio (lib/orders/transfer): manter
// uma cópia aqui já significou a action e a transação discordarem entre si.

// Arquivar é organização de histórico, nunca exclusão: só depois do fim.
const ARCHIVABLE: OrderStatus[] = ["CANCELED", "DELIVERED"];

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pagamento aprovado",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

export async function updateOrderStatus(id: string, status: OrderStatus) {
  await assertArea("pedidos");
  if (!ORDER_STATUSES.includes(status)) {
    return { ok: false as const, error: "Status inválido." };
  }
  // Filial só altera pedidos da própria unidade; matriz, de qualquer uma.
  const target = await prisma.order.findUnique({
    where: { id },
    select: {
      pharmacyId: true,
      status: true,
      paymentMethod: true,
      number: true,
      payment: { select: { externalId: true } },
    },
  });
  if (!target) return { ok: false as const, error: "Pedido não encontrado." };
  await requireAdminAtPharmacy(target.pharmacyId);
  if (target.status === status) return { ok: true as const };
  if (status === "SHIPPED" || status === "DELIVERED") {
    return {
      ok: false as const,
      error: "Use o painel Entregas para atribuir o entregador e registrar o comprovante de recebimento.",
    };
  }
  if (!isValidOrderTransition(target.status, status, target.paymentMethod)) {
    return {
      ok: false as const,
      error: `Transição inválida: ${STATUS_LABEL[target.status]} → ${STATUS_LABEL[status]}.`,
    };
  }

  let warning: string | undefined;
  try {
    if (status === "CANCELED") {
      const canceled = await cancelOrder(id);
      if (canceled?.payment?.status === "REFUND_FAILED") {
        warning =
          "Pedido cancelado, mas o reembolso falhou. Corrija a configuração e tente cancelar novamente para reprocessar.";
      } else if (canceled?.payment?.status === "REFUND_PENDING") {
        warning = "Pedido cancelado; reembolso ainda em processamento no Stripe.";
      }
    } else if (target.status === "PENDING") {
      if (target.paymentMethod !== "cash") {
        if (!target.payment?.externalId) {
          return {
            ok: false as const,
            error: "O Stripe ainda não forneceu um PaymentIntent para confirmar.",
          };
        }
        const { getPaymentStatus } = await import("@/lib/payments/stripe");
        const provider = await getPaymentStatus(target.payment.externalId);
        if (!provider?.paid || provider.referenceId !== target.number) {
          return {
            ok: false as const,
            error: "O Stripe não confirma este pagamento como aprovado.",
          };
        }
      }
      const fulfilled = await fulfillOrder(id);
      if (fulfilled?.status !== status) {
        return {
          ok: false as const,
          error: "O pedido mudou em outra operação. Atualize a página.",
        };
      }
    } else if (!(await transitionOrderStatus(id, target.status, status))) {
      return {
        ok: false as const,
        error: "O pedido mudou em outra operação. Atualize a página.",
      };
    }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Não foi possível atualizar o pedido.",
    };
  }

  const updated = await prisma.order.findUnique({
    where: { id },
    select: { number: true, customerEmail: true },
  });
  if (!updated) return { ok: false as const, error: "Pedido não encontrado." };

  // Notifica o cliente da mudança de status (best-effort).
  if (updated.customerEmail) {
    const mail = orderStatusEmail(
      { number: updated.number },
      STATUS_LABEL[status],
      `${baseUrl()}/pedido/${updated.number}`
    );
    await sendMail({ to: updated.customerEmail, subject: mail.subject, html: mail.html });
  }

  // Único ponto deste arquivo que permanece fora de transação, de propósito: a
  // mudança de status passou por cancelOrder/fulfillOrder/transitionOrderStatus,
  // cada um com a própria transação e a própria evidência (movimento de estoque,
  // linha de pagamento, transação de fidelidade). Abrir outra transação aqui só
  // para o log exigiria aninhar transação — que o Prisma não permite — ou
  // reescrever três funções de domínio para receber a auditoria por parâmetro.
  await logAudit({
    action: "order.status",
    entity: "Order",
    entityId: id,
    detail: `Pedido ${updated.number} → ${STATUS_LABEL[status]}`,
  });

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true as const, warning };
}

export async function retryOrderRefund(id: string) {
  await assertArea("pedidos");
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      pharmacyId: true,
      status: true,
      payment: { select: { status: true } },
    },
  });
  if (!order) return { ok: false as const, error: "Pedido não encontrado." };
  await requireAdminAtPharmacy(order.pharmacyId);
  if (order.status !== "CANCELED" || order.payment?.status !== "REFUND_FAILED") {
    return { ok: false as const, error: "Este reembolso não pode ser reprocessado." };
  }

  const payment = await processOrderRefund(id);
  revalidatePath(`/admin/pedidos/${id}`);
  if (payment?.status === "REFUNDED") return { ok: true as const };
  if (payment?.status === "REFUND_PENDING") {
    return { ok: true as const, warning: "Reembolso em processamento no Stripe." };
  }
  return {
    ok: false as const,
    error: payment?.refundError || "O Stripe não confirmou o reembolso.",
  };
}

/**
 * Reatribui um pedido a outra unidade (matriz ou filial dona do pedido).
 * O movimento de estoque entre unidades é feito por transferOrder.
 */
export async function transferOrderToUnit(orderId: string, targetPharmacyId: string) {
  await assertArea("pedidos");
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { pharmacyId: true, status: true, number: true },
  });
  if (!order) return { ok: false as const, error: "Pedido não encontrado." };

  // Filial só transfere o próprio pedido; matriz, qualquer um.
  await requireAdminAtPharmacy(order.pharmacyId);

  if (!TRANSFERABLE_STATUSES.includes(order.status)) {
    return { ok: false as const, error: "Este pedido não pode mais ser transferido." };
  }
  if (order.pharmacyId === targetPharmacyId) {
    return { ok: false as const, error: "O pedido já está nesta unidade." };
  }
  const target = await prisma.pharmacy.findFirst({
    where: { id: targetPharmacyId, active: true, archivedAt: null },
    select: { id: true },
  });
  if (!target) return { ok: false as const, error: "Unidade de destino inválida." };

  try {
    await transferOrder(orderId, targetPharmacyId);
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Falha ao transferir o pedido.",
    };
  }

  // Avisa a equipe da unidade de destino + registra na auditoria (best-effort;
  // o número veio na primeira query — imutável na transferência).
  await notifyUnit(
    targetPharmacyId,
    orderIncomingTransferEmail(
      { number: order.number },
      `${baseUrl()}/admin/pedidos/${orderId}`
    )
  );
  await logAudit({
    action: "order.transfer",
    entity: "Order",
    entityId: orderId,
    detail: `Pedido ${order.number} transferido para outra unidade`,
    pharmacyId: targetPharmacyId,
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Oculta um pedido encerrado das listas operacionais sem apagar evidência. */
export async function archiveOrder(id: string) {
  await assertOwner();
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      number: true,
      pharmacyId: true,
      status: true,
      archivedAt: true,
    },
  });
  if (!order) return { ok: false as const, error: "Pedido não encontrado." };
  const actor = await requireAdminAtPharmacy(order.pharmacyId);
  if (order.archivedAt) return { ok: true as const };
  if (!ARCHIVABLE.includes(order.status)) {
    return {
      ok: false as const,
      error: "Só é possível arquivar pedidos cancelados ou entregues.",
    };
  }
  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id, archivedAt: null, status: { in: [...ARCHIVABLE] } },
      data: { archivedAt: new Date() },
    });
    await logAuditInTransaction(tx, {
      action: "order.archive",
      entity: "Order",
      entityId: id,
      detail: `Arquivou o pedido ${order.number}`,
      pharmacyId: order.pharmacyId ?? undefined,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
  });

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Recoloca um pedido arquivado nas listas administrativas. */
export async function restoreOrder(id: string) {
  await assertOwner();
  const order = await prisma.order.findUnique({
    where: { id },
    select: { number: true, pharmacyId: true, archivedAt: true },
  });
  if (!order) return { ok: false as const, error: "Pedido não encontrado." };
  const actor = await requireAdminAtPharmacy(order.pharmacyId);
  if (!order.archivedAt) return { ok: true as const };

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    await logAuditInTransaction(tx, {
      action: "order.restore",
      entity: "Order",
      entityId: id,
      detail: `Restaurou o pedido ${order.number}`,
      pharmacyId: order.pharmacyId ?? undefined,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
  });
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Observações do pedido: recado do cliente no checkout + anotações internas
 *  da equipe (mesmo campo, editável pelo admin). */
export async function saveOrderNotes(id: string, notes: string) {
  await assertArea("pedidos");
  const exists = await prisma.order.findUnique({
    where: { id },
    select: { id: true, pharmacyId: true, number: true },
  });
  if (!exists) return { ok: false as const, error: "Pedido não encontrado." };
  const actor = await requireAdminAtPharmacy(exists.pharmacyId);
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: { notes: notes.trim().slice(0, 1000) || null },
    });
    await logAuditInTransaction(tx, {
      action: "order.notes",
      entity: "Order",
      entityId: id,
      detail: `Atualizou as observações do pedido ${exists.number}`,
      pharmacyId: exists.pharmacyId,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
  });
  revalidatePath(`/admin/pedidos/${id}`);
  return { ok: true as const };
}
