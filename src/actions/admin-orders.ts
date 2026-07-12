"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminAtPharmacy, assertOwner } from "@/lib/session";
import { sendMail, baseUrl } from "@/lib/mail";
import { notifyUnit } from "@/lib/notifications";
import { orderStatusEmail, orderIncomingTransferEmail } from "@/lib/email-templates";
import { cancelOrder, transferOrder, fulfillOrder } from "@/lib/orders";
import { logAudit } from "@/lib/audit";
import { Prisma, type OrderStatus } from "@prisma/client";

// Status que representam o pedido seguindo para preparo/entrega. Itens com
// receita só podem chegar aqui após a validação farmacêutica.
const RX_BLOCKED: OrderStatus[] = ["PREPARING", "SHIPPED", "DELIVERED"];

// Estados em que ainda faz sentido reatribuir o pedido a outra unidade.
const TRANSFERABLE: OrderStatus[] = ["PENDING", "PAID", "PREPARING"];

// Só pedidos ENCERRADOS podem ser excluídos definitivamente (ver deleteOrder).
const DELETABLE: OrderStatus[] = ["CANCELED", "DELIVERED"];

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pagamento aprovado",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

export async function updateOrderStatus(id: string, status: OrderStatus) {
  // Filial só altera pedidos da própria unidade; matriz, de qualquer uma.
  const target = await prisma.order.findUnique({
    where: { id },
    select: { pharmacyId: true, status: true },
  });
  if (!target) return { ok: false as const, error: "Pedido não encontrado." };
  if (target.pharmacyId) await requireAdminAtPharmacy(target.pharmacyId);
  else await requireAdmin();

  if (RX_BLOCKED.includes(status)) {
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        requiresPrescription: true,
        prescriptions: { where: { status: "APPROVED" }, select: { id: true }, take: 1 },
      },
    });
    if (order?.requiresPrescription && order.prescriptions.length === 0) {
      return {
        ok: false as const,
        error: "Receita ainda não validada. Aprove a receita antes de preparar/enviar.",
      };
    }
  }

  // Cancelar é um caminho especial: além do status, precisa devolver estoque,
  // estornar pontos/cupom e reembolsar o pagamento. Delega para cancelOrder.
  if (status === "CANCELED") {
    await cancelOrder(id);
  } else {
    // Confirmação manual de um pedido ainda PENDENTE (ex.: webhook do PagBank não
    // chegou): roteia pelo fulfillOrder — baixa estoque, credita pontos e aprova
    // o Payment — antes de aplicar o status escolhido. Sem isso, o "PAGO" na mão
    // seria só um rótulo. fulfillOrder é idempotente e pode deixar em PAID/
    // PREPARING; o update abaixo garante exatamente o status pedido.
    if (target.status === "PENDING" && status !== "PENDING") {
      try {
        await fulfillOrder(id);
      } catch (e) {
        return {
          ok: false as const,
          error:
            e instanceof Error
              ? e.message
              : "Não foi possível confirmar o pagamento (estoque insuficiente?).",
        };
      }
    }
    await prisma.order.update({ where: { id }, data: { status } });
  }

  const updated = await prisma.order.findUnique({
    where: { id },
    select: { number: true, user: { select: { email: true } } },
  });
  if (!updated) return { ok: false as const, error: "Pedido não encontrado." };

  // Notifica o cliente da mudança de status (best-effort).
  if (updated.user.email) {
    const mail = orderStatusEmail(
      { number: updated.number },
      STATUS_LABEL[status],
      `${baseUrl()}/pedido/${updated.number}`
    );
    await sendMail({ to: updated.user.email, subject: mail.subject, html: mail.html });
  }

  await logAudit({
    action: "order.status",
    entity: "Order",
    entityId: id,
    detail: `Pedido ${updated.number} → ${STATUS_LABEL[status]}`,
  });

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true as const };
}

/**
 * Reatribui um pedido a outra unidade (matriz ou filial dona do pedido).
 * O movimento de estoque entre unidades é feito por transferOrder.
 */
export async function transferOrderToUnit(orderId: string, targetPharmacyId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { pharmacyId: true, status: true, number: true },
  });
  if (!order) return { ok: false as const, error: "Pedido não encontrado." };

  // Filial só transfere o próprio pedido; matriz, qualquer um.
  if (order.pharmacyId) await requireAdminAtPharmacy(order.pharmacyId);
  else await requireAdmin();

  if (!TRANSFERABLE.includes(order.status)) {
    return { ok: false as const, error: "Este pedido não pode mais ser transferido." };
  }
  if (order.pharmacyId === targetPharmacyId) {
    return { ok: false as const, error: "O pedido já está nesta unidade." };
  }
  const target = await prisma.pharmacy.findFirst({
    where: { id: targetPharmacyId, active: true },
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

/**
 * Exclui um pedido PERMANENTEMENTE. A remoção cascateia para itens, pagamento e
 * exportação; receitas e pontos de fidelidade ficam com o vínculo nulo (histórico
 * preservado). NÃO estorna pagamento nem devolve estoque — é remoção de registro,
 * não cancelamento (para isso use "Cancelar"). Restrito ao DONO/GERENTE e apenas
 * para pedidos JÁ ENCERRADOS e sem pagamento conciliado no extrato.
 */
export async function deleteOrder(id: string) {
  await assertOwner();
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      number: true,
      pharmacyId: true,
      status: true,
      payment: { select: { bankTx: { select: { id: true } } } },
    },
  });
  if (!order) return { ok: false as const, error: "Pedido não encontrado." };

  // OWNER de filial só apaga pedido da própria unidade; matriz apaga qualquer um.
  if (order.pharmacyId) await requireAdminAtPharmacy(order.pharmacyId);

  // Só pedidos encerrados. Bloqueia excluir um PENDING cujo PIX ainda é pagável
  // (o webhook não teria pedido para casar → pagamento entraria sem registro) e
  // pedidos com dinheiro/estoque em jogo — para esses, o caminho é "Cancelar",
  // que estorna e devolve o estoque.
  if (!DELETABLE.includes(order.status)) {
    return {
      ok: false as const,
      error:
        "Só é possível excluir pedidos cancelados ou entregues. Cancele o pedido antes de excluir.",
    };
  }

  // Pagamento já conciliado no extrato: apagar desfaria a conciliação
  // (BankTransaction.paymentId → null) e distorceria o financeiro.
  if (order.payment?.bankTx) {
    return {
      ok: false as const,
      error:
        "Este pedido tem pagamento conciliado no extrato. Desfaça a conciliação em Financeiro antes de excluir.",
    };
  }

  try {
    await prisma.order.delete({ where: { id } });
  } catch (e) {
    // Corrida: outro admin/aba já apagou (P2025) — trata como já-excluído.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false as const, error: "Pedido não encontrado." };
    }
    throw e;
  }

  await logAudit({
    action: "order.delete",
    entity: "Order",
    entityId: id,
    detail: `Excluiu o pedido ${order.number}`,
    pharmacyId: order.pharmacyId ?? undefined,
  });

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Observações do pedido: recado do cliente no checkout + anotações internas
 *  da equipe (mesmo campo, editável pelo admin). */
export async function saveOrderNotes(id: string, notes: string) {
  const exists = await prisma.order.findUnique({
    where: { id },
    select: { id: true, pharmacyId: true, number: true },
  });
  if (!exists) return { ok: false as const, error: "Pedido não encontrado." };
  if (exists.pharmacyId) await requireAdminAtPharmacy(exists.pharmacyId);
  else await requireAdmin();
  await prisma.order.update({
    where: { id },
    data: { notes: notes.trim().slice(0, 1000) || null },
  });
  await logAudit({
    action: "order.notes",
    entity: "Order",
    entityId: id,
    detail: `Atualizou as observações do pedido ${exists.number}`,
  });
  revalidatePath(`/admin/pedidos/${id}`);
  return { ok: true as const };
}
