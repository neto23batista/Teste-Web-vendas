import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  changeInventory,
  InsufficientInventoryError,
} from "@/lib/inventory-movements";

const upsert = vi.fn();
const updateMany = vi.fn();
const findUnique = vi.fn();
const createMovement = vi.fn();

const tx = {
  inventory: { upsert, updateMany, findUnique },
  inventoryMovement: { create: createMovement },
} as unknown as Prisma.TransactionClient;

beforeEach(() => {
  vi.clearAllMocks();
  createMovement.mockResolvedValue({});
});

describe("livro razão de estoque", () => {
  it("incrementa atomicamente e deriva o saldo anterior do retorno do upsert", async () => {
    upsert.mockResolvedValue({ id: "inv-1", stock: 8 });

    await expect(
      changeInventory(tx, {
        productId: "p-1",
        pharmacyId: "ph-1",
        delta: 3,
        kind: "MANUAL_ADJUSTMENT",
        reason: "Recebimento manual",
      })
    ).resolves.toEqual({ inventoryId: "inv-1", stockBefore: 5, stockAfter: 8 });

    expect(createMovement).toHaveBeenCalledWith({
      data: expect.objectContaining({ delta: 3, stockBefore: 5, stockAfter: 8 }),
    });
  });

  it("decrementa somente com saldo e grava o movimento correspondente", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue({ id: "inv-1", stock: 2 });

    await changeInventory(tx, {
      productId: "p-1",
      pharmacyId: "ph-1",
      delta: -3,
      kind: "MANUAL_ADJUSTMENT",
      reason: "Perda identificada",
    });

    expect(createMovement).toHaveBeenCalledWith({
      data: expect.objectContaining({ delta: -3, stockBefore: 5, stockAfter: 2 }),
    });
  });

  it("recusa saldo insuficiente sem produzir uma linha de movimento", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      changeInventory(tx, {
        productId: "p-1",
        pharmacyId: "ph-1",
        delta: -6,
        kind: "MANUAL_ADJUSTMENT",
        reason: "Retirada manual",
      })
    ).rejects.toBeInstanceOf(InsufficientInventoryError);
    expect(createMovement).not.toHaveBeenCalled();
  });
});
