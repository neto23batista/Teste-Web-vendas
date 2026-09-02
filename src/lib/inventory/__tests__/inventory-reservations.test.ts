import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inventoryReservationExpiresAt,
  releaseOrderInventoryReservations,
  reserveOrderInventory,
  transferOrderInventoryReservations,
} from "@/lib/inventory/reservations";

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
        { id: "lot-first", qty: 1, expiresAt: new Date("2026-09-02T12:00:00.000Z") },
        { id: "lot-second", qty: 5, expiresAt: new Date("2027-03-01T12:00:00.000Z") },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    inventoryReservation: {
      create: vi.fn().mockResolvedValue({ id: "reservation-1" }),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    inventoryReservationLot: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("reservas de estoque", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T18:00:00.000Z"));
  });

  afterEach(() => vi.useRealTimers());

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

  const orderInput = {
    orderId: "order-1",
    orderNumber: "FV-1",
    pharmacyId: "pharmacy-1",
    items: [{ id: "item-1", productId: "product-1", name: "Produto", qty: 3 }],
  };

  it("não vende saldo vencido como se fosse estoque legado sem lote", async () => {
    const tx = reservationTx();
    tx.inventoryLot.findMany.mockResolvedValue([
      { id: "expired", qty: 8, expiresAt: new Date("2026-09-01T12:00:00.000Z") },
      { id: "valid", qty: 2, expiresAt: new Date("2027-03-01T12:00:00.000Z") },
    ]);
    await expect(reserveOrderInventory(tx as never, orderInput)).rejects.toThrow("Estoque válido insuficiente");
    expect(tx.inventoryReservationLot.create).not.toHaveBeenCalled();
    expect(tx.inventoryLot.updateMany).not.toHaveBeenCalled();
  });

  it("permite somente a parcela válida mais o estoque realmente sem lote", async () => {
    const tx = reservationTx();
    tx.inventoryLot.findMany.mockResolvedValue([
      { id: "expired", qty: 7, expiresAt: new Date("2026-09-01T12:00:00.000Z") },
      { id: "valid", qty: 2, expiresAt: new Date("2027-03-01T12:00:00.000Z") },
    ]);
    await reserveOrderInventory(tx as never, orderInput);
    expect(tx.inventoryReservationLot.create).toHaveBeenCalledExactlyOnceWith({
      data: { reservationId: "reservation-1", lotId: "valid", qty: 2 },
    });
    expect(tx.inventoryLot.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "expired" }) }));
  });

  it("falha fechado quando a soma dos lotes supera o estoque físico", async () => {
    const tx = reservationTx();
    tx.inventoryLot.findMany.mockResolvedValue([
      { id: "inconsistent", qty: 11, expiresAt: new Date("2027-03-01T12:00:00.000Z") },
    ]);
    await expect(reserveOrderInventory(tx as never, orderInput)).rejects.toThrow("diverge do estoque");
    expect(tx.inventoryReservationLot.create).not.toHaveBeenCalled();
  });

  it("respeita a virada do dia em São Paulo, não o fuso do servidor", async () => {
    vi.setSystemTime(new Date("2026-09-03T02:59:59.000Z"));
    const tx = reservationTx();
    tx.inventoryLot.findMany.mockResolvedValue([
      { id: "today", qty: 10, expiresAt: new Date("2026-09-02T12:00:00.000Z") },
    ]);
    await reserveOrderInventory(tx as never, orderInput);
    vi.setSystemTime(new Date("2026-09-03T03:00:00.000Z"));
    await expect(reserveOrderInventory(tx as never, orderInput)).rejects.toThrow("Estoque válido insuficiente");
  });

  it("não duplica a liberação quando outra transação já assumiu a reserva", async () => {
    const tx = reservationTx();
    tx.inventoryReservation.findMany.mockResolvedValue([{ id: "reservation-1", status: "ACTIVE" }]);
    tx.inventoryReservation.updateMany.mockResolvedValue({ count: 0 });
    expect(await releaseOrderInventoryReservations(tx as never, { orderId: "order-1", orderNumber: "FV-1", reason: "Cancelamento" })).toBe(0);
    expect(tx.inventory.upsert).not.toHaveBeenCalled();
    expect(tx.inventoryLot.update).not.toHaveBeenCalled();
  });

  it("também recusa estoque vencido na unidade de destino de uma transferência", async () => {
    const tx = reservationTx();
    tx.inventoryReservation.findMany.mockResolvedValue([{
      id: "reservation-1", orderId: "order-1", productId: "product-1",
      pharmacyId: "pharmacy-1", qty: 3, status: "ACTIVE", allocations: [],
    }]);
    tx.inventoryLot.findMany.mockResolvedValue([
      { id: "expired", qty: 10, expiresAt: new Date("2026-09-01T12:00:00.000Z") },
    ]);
    await expect(transferOrderInventoryReservations(tx as never, {
      orderId: "order-1", orderNumber: "FV-1", targetPharmacyId: "pharmacy-2",
    })).rejects.toThrow("Estoque válido insuficiente");
    expect(tx.inventoryReservationLot.create).not.toHaveBeenCalled();
  });
});
