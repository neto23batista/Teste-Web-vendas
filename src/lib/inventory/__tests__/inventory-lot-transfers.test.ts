import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transferPhysicalInventory } from "@/lib/inventory/lot-transfers";

const input = { productId: "product-1", fromPharmacyId: "unit-a", toPharmacyId: "unit-b", qty: 4, transferId: "transfer-1", actor: null };
const lot = {
  id: "lot-1", lotCode: "A", qty: 2, productId: "product-1", pharmacyId: "unit-a",
  expiresAt: new Date("2026-09-10T12:00:00.000Z"), receivedAt: new Date("2026-08-01T12:00:00.000Z"),
  supplier: "Fornecedor", note: "Recebimento original",
};

function transferTx() {
  return {
    pharmacy: { findMany: vi.fn().mockResolvedValue([{ id: "unit-a" }, { id: "unit-b" }]) },
    $queryRaw: vi.fn().mockResolvedValue([{ pharmacyId: "unit-a", stock: 10 }, { pharmacyId: "unit-b", stock: 2 }]),
    inventory: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: "inventory-a", stock: 6 }),
      upsert: vi.fn().mockResolvedValue({ id: "inventory-b", stock: 6 }),
    },
    inventoryMovement: { create: vi.fn() },
    inventoryLot: {
      findMany: vi.fn().mockResolvedValue([lot, { ...lot, id: "lot-2", lotCode: "B", qty: 3, expiresAt: new Date("2027-01-01T12:00:00.000Z") }]),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("transferência física com rastreabilidade de lotes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T18:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("preserva lote, validade e origem do recebimento no destino", async () => {
    const tx = transferTx();
    await transferPhysicalInventory(tx as never, input);
    expect(tx.inventoryLot.upsert).toHaveBeenNthCalledWith(1, {
      where: { productId_pharmacyId_lotCode: { productId: "product-1", pharmacyId: "unit-b", lotCode: "A" } },
      create: {
        productId: "product-1", pharmacyId: "unit-b", lotCode: "A", expiresAt: lot.expiresAt,
        qty: 2, supplier: lot.supplier, note: lot.note, receivedAt: lot.receivedAt,
      },
      update: { qty: { increment: 2 } },
    });
    expect(tx.inventoryLot.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "lot-2", qty: { gte: 2 } }, data: { qty: { decrement: 2 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.inventoryMovement.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({
      kind: "TRANSFER_OUT", delta: -4, referenceId: "transfer-1", stockBefore: 10, stockAfter: 6,
    }) });
  });

  it("trava ambas as unidades em ordem determinística antes de alterar os saldos", async () => {
    const tx = transferTx();
    await transferPhysicalInventory(tx as never, input);
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toMatch(/ORDER BY "pharmacyId" FOR UPDATE/);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.inventory.updateMany.mock.invocationCallOrder[0]);
    expect(tx.inventoryLot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
    }));
  });

  it("mantém a transferência do estoque legado realmente sem lote", async () => {
    const tx = transferTx();
    tx.inventoryLot.findMany.mockResolvedValue([]);
    await transferPhysicalInventory(tx as never, input);
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.inventoryLot.upsert).not.toHaveBeenCalled();
  });

  it("não transforma lote vencido em estoque livre no destino", async () => {
    const tx = transferTx();
    tx.inventoryLot.findMany.mockResolvedValue([{ ...lot, qty: 8, expiresAt: new Date("2026-09-01T12:00:00.000Z") }]);
    await expect(transferPhysicalInventory(tx as never, input)).rejects.toThrow("Estoque válido insuficiente");
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.inventoryLot.upsert).not.toHaveBeenCalled();
  });

  it("não altera a validade de um lote já existente na unidade de destino", async () => {
    const tx = transferTx();
    tx.inventoryLot.findUnique.mockResolvedValue({ expiresAt: new Date("2027-12-01T12:00:00.000Z") });
    await expect(transferPhysicalInventory(tx as never, input)).rejects.toThrow("outra validade");
    expect(tx.inventoryLot.upsert).not.toHaveBeenCalled();
  });

  it("rejeita unidade inativa antes de criar estoque", async () => {
    const tx = transferTx();
    tx.pharmacy.findMany.mockResolvedValue([{ id: "unit-a" }]);
    await expect(transferPhysicalInventory(tx as never, input)).rejects.toThrow("unidades ativas");
    expect(tx.inventory.createMany).not.toHaveBeenCalled();
  });

  it("não cria saldo no lote de destino se o saldo de origem mudou", async () => {
    const tx = transferTx();
    tx.inventoryLot.updateMany.mockResolvedValue({ count: 0 });
    await expect(transferPhysicalInventory(tx as never, input)).rejects.toThrow("saldo do lote mudou");
    expect(tx.inventoryLot.upsert).not.toHaveBeenCalled();
  });
});
