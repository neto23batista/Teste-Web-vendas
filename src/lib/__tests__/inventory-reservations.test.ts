import { describe, expect, it, vi } from "vitest";
import {
  inventoryReservationExpiresAt,
  releaseOrderInventoryReservations,
  reserveOrderInventory,
} from "@/lib/inventory-reservations";

function reservationTx() {
  return {
    inventory: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: "inv-1", stock: 7 }),
      upsert: vi.fn().mockResolvedValue({ id: "inv-1", stock: 10 }),
    },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
    inventoryLot: {
      findMany: vi.fn().mockResolvedValue([
        { id: "lot-first", qty: 1 },
        { id: "lot-second", qty: 5 },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    inventoryReservation: {
      create: vi.fn().mockResolvedValue({ id: "reservation-1" }),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    inventoryReservationLot: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("reservas de estoque", () => {
  it("reserva o saldo disponível e aloca lotes por FEFO", async () => {
    const tx = reservationTx();
    await reserveOrderInventory(tx as never, {
      orderId: "order-1",
      orderNumber: "FV-1",
      pharmacyId: "pharmacy-1",
      items: [{ id: "item-1", productId: "product-1", name: "Produto", qty: 3 }],
    });

    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        productId: "product-1",
        pharmacyId: "pharmacy-1",
        stock: { gte: 3 },
      },
      data: { stock: { decrement: 3 } },
    });
    expect(tx.inventoryReservationLot.create).toHaveBeenNthCalledWith(1, {
      data: { reservationId: "reservation-1", lotId: "lot-first", qty: 1 },
    });
    expect(tx.inventoryReservationLot.create).toHaveBeenNthCalledWith(2, {
      data: { reservationId: "reservation-1", lotId: "lot-second", qty: 2 },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "RESERVATION",
        delta: -3,
        stockBefore: 10,
        stockAfter: 7,
        referenceId: "order-1",
      }),
    });
  });

  it("libera uma reserva uma única vez e devolve seus lotes", async () => {
    const tx = reservationTx();
    tx.inventoryReservation.findMany.mockResolvedValue([
      {
        id: "reservation-1",
        orderId: "order-1",
        productId: "product-1",
        pharmacyId: "pharmacy-1",
        qty: 3,
        status: "ACTIVE",
        allocations: [{ lotId: "lot-first", qty: 1 }, { lotId: "lot-second", qty: 2 }],
      },
    ]);

    const released = await releaseOrderInventoryReservations(tx as never, {
      orderId: "order-1",
      orderNumber: "FV-1",
      reason: "Cancelamento",
    });

    expect(released).toBe(1);
    expect(tx.inventory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { stock: { increment: 3 } } })
    );
    expect(tx.inventoryLot.update).toHaveBeenCalledTimes(2);
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "RELEASE", delta: 3 }),
    });
  });

  it("mantém a reserva por 25 horas para cobrir a janela de pagamento", () => {
    const now = new Date("2026-09-01T10:00:00.000Z");
    expect(inventoryReservationExpiresAt(now).toISOString()).toBe(
      "2026-09-02T11:00:00.000Z"
    );
  });
});
