import type { InventoryReservationStatus, Prisma } from "@prisma/client";
import { changeInventory } from "@/lib/inventory-movements";

type ReservationWriter = Pick<
  Prisma.TransactionClient,
  | "inventory"
  | "inventoryMovement"
  | "inventoryLot"
  | "inventoryReservation"
  | "inventoryReservationLot"
>;

type ReservableItem = {
  id: string;
  productId: string | null;
  name: string;
  qty: number;
};

const PAYMENT_WINDOW_MS = 25 * 60 * 60 * 1000;

export function inventoryReservationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + PAYMENT_WINDOW_MS);
}

async function allocateTrackedLots(
  tx: ReservationWriter,
  input: {
    reservationId: string;
    productId: string;
    pharmacyId: string;
    qty: number;
    now?: Date;
  }
) {
  let remaining = input.qty;
  const lots = await tx.inventoryLot.findMany({
    where: {
      productId: input.productId,
      pharmacyId: input.pharmacyId,
      qty: { gt: 0 },
      expiresAt: { gt: input.now ?? new Date() },
    },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
    select: { id: true, qty: true },
  });

  for (const lot of lots) {
    if (remaining <= 0) break;
    const qty = Math.min(lot.qty, remaining);
    const changed = await tx.inventoryLot.updateMany({
      where: { id: lot.id, qty: { gte: qty } },
      data: { qty: { decrement: qty } },
    });
    if (changed.count !== 1) {
      throw new Error("Um lote mudou durante a reserva. Atualize a página e tente novamente.");
    }
    await tx.inventoryReservationLot.create({
      data: { reservationId: input.reservationId, lotId: lot.id, qty },
    });
    remaining -= qty;
  }
}

export async function reserveOrderInventory(
  tx: ReservationWriter,
  input: {
    orderId: string;
    orderNumber: string;
    pharmacyId: string;
    items: ReservableItem[];
    expiresAt?: Date;
  }
) {
  const expiresAt = input.expiresAt ?? inventoryReservationExpiresAt();
  for (const item of input.items) {
    if (!item.productId) {
      throw new Error(`O produto "${item.name}" não está mais disponível para reserva.`);
    }
    if (!Number.isSafeInteger(item.qty) || item.qty <= 0) {
      throw new Error(`Quantidade inválida para "${item.name}".`);
    }

    await changeInventory(tx, {
      productId: item.productId,
      pharmacyId: input.pharmacyId,
      delta: -item.qty,
      kind: "RESERVATION",
      reason: `Reserva para o pedido ${input.orderNumber}`,
      referenceType: "ORDER",
      referenceId: input.orderId,
    });
    const reservation = await tx.inventoryReservation.create({
      data: {
        orderId: input.orderId,
        orderItemId: item.id,
        productId: item.productId,
        pharmacyId: input.pharmacyId,
        qty: item.qty,
        expiresAt,
      },
      select: { id: true },
    });
    await allocateTrackedLots(tx, {
      reservationId: reservation.id,
      productId: item.productId,
      pharmacyId: input.pharmacyId,
      qty: item.qty,
    });
  }
}

export async function commitOrderInventoryReservations(
  tx: ReservationWriter,
  orderId: string
) {
  return tx.inventoryReservation.updateMany({
    where: { orderId, status: "ACTIVE" },
    data: { status: "COMMITTED", committedAt: new Date() },
  });
}

export async function releaseOrderInventoryReservations(
  tx: ReservationWriter,
  input: { orderId: string; orderNumber: string; reason: string }
) {
  const reservations = await tx.inventoryReservation.findMany({
    where: { orderId: input.orderId, status: { in: ["ACTIVE", "COMMITTED"] } },
    include: { allocations: true },
  });

  let released = 0;
  for (const reservation of reservations) {
    const claimed = await tx.inventoryReservation.updateMany({
      where: {
        id: reservation.id,
        status: reservation.status,
      },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    await changeInventory(tx, {
      productId: reservation.productId,
      pharmacyId: reservation.pharmacyId,
      delta: reservation.qty,
      kind: "RELEASE",
      reason: input.reason,
      referenceType: "ORDER",
      referenceId: input.orderId,
    });
    for (const allocation of reservation.allocations) {
      await tx.inventoryLot.update({
        where: { id: allocation.lotId },
        data: { qty: { increment: allocation.qty } },
      });
    }
    released += 1;
  }
  return released;
}

export async function transferOrderInventoryReservations(
  tx: ReservationWriter,
  input: {
    orderId: string;
    orderNumber: string;
    targetPharmacyId: string;
  }
) {
  const reservations = await tx.inventoryReservation.findMany({
    where: { orderId: input.orderId, status: { in: ["ACTIVE", "COMMITTED"] } },
    include: { allocations: true },
  });

  for (const reservation of reservations) {
    await changeInventory(tx, {
      productId: reservation.productId,
      pharmacyId: input.targetPharmacyId,
      delta: -reservation.qty,
      kind: "RESERVATION",
      reason: `Reserva transferida do pedido ${input.orderNumber}`,
      referenceType: "ORDER_TRANSFER",
      referenceId: input.orderId,
    });
    await changeInventory(tx, {
      productId: reservation.productId,
      pharmacyId: reservation.pharmacyId,
      delta: reservation.qty,
      kind: "RELEASE",
      reason: `Reserva transferida do pedido ${input.orderNumber}`,
      referenceType: "ORDER_TRANSFER",
      referenceId: input.orderId,
    });
    for (const allocation of reservation.allocations) {
      await tx.inventoryLot.update({
        where: { id: allocation.lotId },
        data: { qty: { increment: allocation.qty } },
      });
    }
    await tx.inventoryReservationLot.deleteMany({
      where: { reservationId: reservation.id },
    });
    await tx.inventoryReservation.update({
      where: { id: reservation.id },
      data: { pharmacyId: input.targetPharmacyId },
    });
    await allocateTrackedLots(tx, {
      reservationId: reservation.id,
      productId: reservation.productId,
      pharmacyId: input.targetPharmacyId,
      qty: reservation.qty,
    });
  }
  return reservations.length;
}

export type ReservationStatus = InventoryReservationStatus;
