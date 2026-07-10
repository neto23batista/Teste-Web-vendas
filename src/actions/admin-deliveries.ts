"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Cadastra um entregador para uma unidade (ou geral, sem unidade). */
export async function createCourier(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("entregas");
  const name = str(formData, "name");
  const phone = str(formData, "phone") || null;
  const pharmacyId = str(formData, "pharmacyId") || null;
  if (name.length < 3) return { ok: false, error: "Informe o nome do entregador." };
  if (pharmacyId) await requireAdminAtPharmacy(pharmacyId);

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
  if (c.pharmacyId) await requireAdminAtPharmacy(c.pharmacyId);

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
  if (order.pharmacyId) await requireAdminAtPharmacy(order.pharmacyId);
  if (order.status !== "PAID" && order.status !== "PREPARING") {
    return { ok: false, error: "Só um pedido pago e em preparo pode sair para entrega." };
  }
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { name: true, active: true },
  });
  if (!courier?.active) return { ok: false, error: "Entregador indisponível." };

  await prisma.order.update({
    where: { id: orderId },
    data: { courierId, status: "SHIPPED", dispatchedAt: new Date() },
  });
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
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("entregas");
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, number: true, pharmacyId: true },
  });
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if (order.pharmacyId) await requireAdminAtPharmacy(order.pharmacyId);
  if (order.status !== "SHIPPED") {
    return { ok: false, error: "Só um pedido que saiu para entrega pode ser concluído." };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  await logAudit({
    action: "delivery.done",
    entity: "Order",
    entityId: orderId,
    detail: `Pedido ${order.number} entregue`,
    pharmacyId: order.pharmacyId,
  });
  revalidatePath("/admin/entregas");
  revalidatePath(`/pedido/${order.number}`);
  return { ok: true };
}
