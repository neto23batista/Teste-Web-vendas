"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { markOrderDelivered, transitionOrderStatus } from "@/lib/orders";
import type { DeliveryProofMethod } from "@prisma/client";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Cadastra um entregador vinculado obrigatoriamente a uma unidade. */
export async function createCourier(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("entregas");
  const name = str(formData, "name");
  const phone = str(formData, "phone") || null;
  const pharmacyId = str(formData, "pharmacyId") || null;
  if (name.length < 3) return { ok: false, error: "Informe o nome do entregador." };
  if (!pharmacyId) return { ok: false, error: "Selecione a unidade do entregador." };
  await requireAdminAtPharmacy(pharmacyId);

  await prisma.courier.create({ data: { name, phone, pharmacyId } });
  await logAudit({
    action: "courier.create",
    entity: "Courier",
    detail: `Entregador ${name} cadastrado`,
    pharmacyId,
  });
  revalidatePath("/admin/entregas");
  return { ok: true };
}

/** Ativa/desativa um entregador (sem apagar histórico de pedidos). */
export async function toggleCourier(
  courierId: string
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("entregas");
  const c = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { active: true, name: true, pharmacyId: true },
  });
  if (!c) return { ok: false, error: "Entregador não encontrado." };
  await requireAdminAtPharmacy(c.pharmacyId);

  await prisma.courier.update({ where: { id: courierId }, data: { active: !c.active } });
  revalidatePath("/admin/entregas");
  return { ok: true };
}

/**
 * Despacha o pedido: designa o entregador e marca SHIPPED (saiu para entrega).
 * Só pedidos pagos e ainda não entregues podem sair.
 */
export async function dispatchOrder(
  orderId: string,
  courierId: string
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("entregas");
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, number: true, pharmacyId: true },
  });
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  await requireAdminAtPharmacy(order.pharmacyId);
  if (order.status !== "PREPARING") {
    return { ok: false, error: "Só um pedido em preparo pode sair para entrega." };
  }
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { name: true, active: true, pharmacyId: true },
  });
  if (!courier?.active) return { ok: false, error: "Entregador indisponível." };
  if (!order.pharmacyId || courier.pharmacyId !== order.pharmacyId) {
    return {
      ok: false,
      error: "O entregador precisa pertencer à mesma unidade do pedido.",
    };
  }

  if (
    !(await transitionOrderStatus(orderId, "PREPARING", "SHIPPED", {
      courierId,
    }))
  ) {
    return { ok: false, error: "O pedido mudou em outra operação. Atualize a página." };
  }
  await logAudit({
    action: "delivery.dispatch",
    entity: "Order",
    entityId: orderId,
    detail: `Pedido ${order.number} saiu para entrega com ${courier.name}`,
    pharmacyId: order.pharmacyId,
  });
  revalidatePath("/admin/entregas");
  revalidatePath(`/pedido/${order.number}`);
  return { ok: true };
}

/** Confirma a entrega (status DELIVERED + carimbo de hora). */
export async function markDelivered(
  orderId: string,
  proof: {
    method: DeliveryProofMethod;
    recipientName: string;
    recipientDocumentLast4?: string;
    notes?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const actor = await assertArea("entregas");
  const recipientName = proof.recipientName.trim().slice(0, 160);
  const documentLast4 = proof.recipientDocumentLast4?.replace(/\D/g, "") || null;
  const notes = proof.notes?.trim().slice(0, 1000) || null;
  if (!(["RECIPIENT", "CONCIERGE", "SAFE_PLACE", "PICKUP"] as string[]).includes(proof.method)) {
    return { ok: false, error: "Forma de comprovação inválida." };
  }
  if (recipientName.length < 2) {
    return { ok: false, error: "Informe quem recebeu o pedido." };
  }
  if (documentLast4 && documentLast4.length !== 4) {
    return { ok: false, error: "Informe somente os 4 últimos dígitos do documento." };
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      number: true,
      pharmacyId: true,
      courier: { select: { name: true } },
    },
  });
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  await requireAdminAtPharmacy(order.pharmacyId);
  if (order.status !== "SHIPPED") {
    return { ok: false, error: "Só um pedido que saiu para entrega pode ser concluído." };
  }

  if (
    !(await markOrderDelivered(orderId, {
      method: proof.method,
      recipientName,
      recipientDocumentLast4: documentLast4,
      notes,
      courierName: order.courier?.name ?? null,
      confirmedById: actor.id ?? null,
      confirmedByEmail: actor.email ?? null,
    }))
  ) {
    return { ok: false, error: "O pedido mudou em outra operação. Atualize a página." };
  }
  await logAudit({
    action: "delivery.done",
    entity: "Order",
    entityId: orderId,
    detail: `Pedido ${order.number} entregue a ${recipientName} com comprovante ${proof.method}`,
    pharmacyId: order.pharmacyId,
  });
  revalidatePath("/admin/entregas");
  revalidatePath(`/pedido/${order.number}`);
  return { ok: true };
}
