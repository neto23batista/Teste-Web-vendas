"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { sendMail, baseUrl } from "@/lib/mail";
import { orderStatusEmail } from "@/lib/email-templates";
import { cancelOrder } from "@/lib/orders";
import type { OrderStatus } from "@prisma/client";

// Status que representam o pedido seguindo para preparo/entrega. Itens com
// receita só podem chegar aqui após a validação farmacêutica.
const RX_BLOCKED: OrderStatus[] = ["PREPARING", "SHIPPED", "DELIVERED"];

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pagamento aprovado",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

export async function updateOrderStatus(id: string, status: OrderStatus) {
  await requireAdmin();

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

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Observações do pedido: recado do cliente no checkout + anotações internas
 *  da equipe (mesmo campo, editável pelo admin). */
export async function saveOrderNotes(id: string, notes: string) {
  await requireAdmin();
  const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { ok: false as const, error: "Pedido não encontrado." };
  await prisma.order.update({
    where: { id },
    data: { notes: notes.trim().slice(0, 1000) || null },
  });
  revalidatePath(`/admin/pedidos/${id}`);
  return { ok: true as const };
}
