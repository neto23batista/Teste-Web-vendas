import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { changeInventory } from "@/lib/inventory/movements";
import { inLockOrder } from "@/lib/concurrency";
import { reconcileLotsAfterUntrackedDecrease } from "@/lib/inventory/lot-consumption";
import { transferOrderInventoryReservations } from "@/lib/inventory/reservations";
import { assertValidInventoryItems } from "@/lib/orders/policy";
import { revalidateProductsSafe } from "@/lib/orders/shared";

/**
 * Depois do despacho a mercadoria já saiu: mudar a unidade responsável passaria
 * a mover estoque de algo que fisicamente não está mais lá.
 */
export const TRANSFERABLE_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "PREPARING",
];

/** Sinaliza que o pedido mudou entre a leitura e a escrita — o chamador reapresenta. */
export class OrderTransferConflictError extends Error {}

/**
 * Transfere um pedido para outra unidade, movendo o estoque corretamente:
 *  - Pedidos novos: move a reserva (inclusive enquanto PENDING).
 *  - Pedidos legados já "fulfilled" (PAID/PREPARING): baixa condicional no
 *    destino e devolve à origem. Se faltar estoque no destino, a transação
 *    inteira é abortada e a unidade NÃO muda.
 *
 * Status e unidade de origem são reconferidos DENTRO da transação, sobre a linha
 * travada: o retrato lido antes envelhece, e um despacho concorrente
 * (PREPARING → SHIPPED) passava exatamente nessa janela.
 *
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
  if (!TRANSFERABLE_STATUSES.includes(order.status)) {
    throw new Error("Este pedido não pode mais ser transferido.");
  }

  const target = await prisma.pharmacy.findFirst({
    where: { id: targetPharmacyId, active: true, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!target) throw new Error("Unidade de destino inválida.");

  const stamp = new Date().toLocaleString("pt-BR");
  const auditNote = `Transferido de ${order.pharmacy?.name ?? "—"} para ${target.name} em ${stamp}.`;
  const mergedNotes = (
    order.notes ? `${order.notes}\n${auditNote}` : auditNote
  ).slice(0, 2000);

  await prisma.$transaction(async (tx) => {
    // Trava a linha e reconfere. `FOR UPDATE` faz o despacho concorrente esperar
    // — ou, se ele chegou primeiro, faz esta leitura já enxergar SHIPPED.
    const locked = await tx.$queryRaw<
      { status: OrderStatus; pharmacyId: string | null }[]
    >`
      SELECT "status", "pharmacyId" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE
    `;
    const current = locked[0];
    if (!current) throw new Error("Pedido não encontrado.");
    if (!TRANSFERABLE_STATUSES.includes(current.status)) {
      throw new OrderTransferConflictError(
        "Este pedido saiu para entrega enquanto a transferência era feita e não pode mais mudar de unidade.",
      );
    }
    if (current.pharmacyId !== sourcePharmacyId) {
      throw new OrderTransferConflictError(
        "A unidade do pedido mudou em outra operação. Atualize a página e tente novamente.",
      );
    }

    // Só pedidos que saíram de PENDING tiveram baixa de estoque (via
    // fulfillOrder) — avaliado sobre o status recém-travado, não sobre o retrato.
    const wasFulfilled = current.status !== "PENDING";
    if (wasFulfilled) assertValidInventoryItems(order.items);

    const movedReservations = await transferOrderInventoryReservations(tx, {
      orderId: order.id,
      orderNumber: order.number,
      targetPharmacyId: target.id,
    });
    if (wasFulfilled && movedReservations === 0) {
      for (const item of inLockOrder(order.items)) {
        if (!item.productId) continue;
        // Baixa condicional no destino primeiro: se faltar, aborta a transação.
        const taken = await changeInventory(tx, {
          productId: item.productId,
          pharmacyId: target.id,
          delta: -item.qty,
          kind: "TRANSFER_OUT",
          reason: `Transferência do pedido legado ${order.number}`,
          referenceType: "ORDER_TRANSFER",
          referenceId: order.id,
        });
        // Mesma razão da baixa legada em fulfillOrder: o destino perdeu estoque
        // sem consumir lote, e isso travaria as reservas daquela unidade.
        await reconcileLotsAfterUntrackedDecrease(tx, {
          productId: item.productId,
          pharmacyId: target.id,
          stockAfter: taken.stockAfter,
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

    // Escrita condicional: mesmo com o lock, é a rede de segurança que garante
    // que só gravamos sobre o estado que acabamos de validar.
    const moved = await tx.order.updateMany({
      where: {
        id: order.id,
        status: current.status,
        pharmacyId: sourcePharmacyId,
      },
      data: { pharmacyId: target.id, notes: mergedNotes },
    });
    if (moved.count !== 1) {
      throw new OrderTransferConflictError(
        "O pedido mudou em outra operação. Atualize a página e tente novamente.",
      );
    }
  });

  // Estoque mudou — invalida o cache das listas de produto.
  revalidateProductsSafe();
  return prisma.order.findUnique({ where: { id: order.id } });
}
