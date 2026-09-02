import { prisma } from "@/lib/prisma";
import { changeInventory } from "@/lib/inventory/movements";
import { transferOrderInventoryReservations } from "@/lib/inventory/reservations";
import { assertValidInventoryItems } from "@/lib/orders/policy";
import { revalidateProductsSafe } from "@/lib/orders/shared";

/**
 * Transfere um pedido para outra unidade, movendo o estoque corretamente:
 *  - Pedidos novos: move a reserva (inclusive enquanto PENDING).
 *  - Pedidos legados já "fulfilled" (PAID/PREPARING/...): baixa do destino
 *    condicional anti-corrida) e devolve à origem. Se faltar estoque no destino,
 *    a transação inteira é abortada (lança Error) e a unidade NÃO muda.
 * Registra uma nota de auditoria. Retorna o pedido atualizado.
 */
export async function transferOrder(orderId: string, targetPharmacyId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, pharmacy: { select: { name: true } } },
  });
  if (!order) throw new Error("Pedido não encontrado.");

  const sourcePharmacyId = order.pharmacyId;
  if (sourcePharmacyId === targetPharmacyId) {
    throw new Error("O pedido já está nesta unidade.");
  }

  const target = await prisma.pharmacy.findFirst({
    where: { id: targetPharmacyId, active: true, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!target) throw new Error("Unidade de destino inválida.");

  // Só pedidos que saíram de PENDING tiveram baixa de estoque (via fulfillOrder).
  const wasFulfilled =
    order.status !== "PENDING" && order.status !== "CANCELED";

  if (wasFulfilled) {
    assertValidInventoryItems(order.items);
  }

  const stamp = new Date().toLocaleString("pt-BR");
  const auditNote = `Transferido de ${order.pharmacy?.name ?? "—"} para ${target.name} em ${stamp}.`;
  const mergedNotes = (
    order.notes ? `${order.notes}\n${auditNote}` : auditNote
  ).slice(0, 2000);

  await prisma.$transaction(async (tx) => {
    const movedReservations = await transferOrderInventoryReservations(tx, {
      orderId: order.id,
      orderNumber: order.number,
      targetPharmacyId: target.id,
    });
    if (wasFulfilled && movedReservations === 0) {
      for (const item of order.items) {
        if (!item.productId) continue;
        // Baixa condicional no destino primeiro: se faltar, aborta a transação.
        await changeInventory(tx, {
          productId: item.productId,
          pharmacyId: target.id,
          delta: -item.qty,
          kind: "TRANSFER_OUT",
          reason: `Transferência do pedido legado ${order.number}`,
          referenceType: "ORDER_TRANSFER",
          referenceId: order.id,
        });
        // Devolve o estoque à unidade de origem.
        if (sourcePharmacyId) {
          await changeInventory(tx, {
            productId: item.productId,
            pharmacyId: sourcePharmacyId,
            delta: item.qty,
            kind: "TRANSFER_IN",
            reason: `Transferência do pedido legado ${order.number}`,
            referenceType: "ORDER_TRANSFER",
            referenceId: order.id,
          });
        }
      }
    }
    await tx.order.update({
      where: { id: order.id },
      data: { pharmacyId: target.id, notes: mergedNotes },
    });
  });

  // Estoque mudou — invalida o cache das listas de produto.
  revalidateProductsSafe();
  return prisma.order.findUnique({ where: { id: order.id } });
}
