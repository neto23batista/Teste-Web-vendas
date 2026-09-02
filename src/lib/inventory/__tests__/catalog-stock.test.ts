import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  lots: vi.fn(),
  change: vi.fn(),
  movements: vi.fn(),
}));
vi.mock("../movements", () => ({ changeInventory: mocks.change }));
import {
  recordInitialCatalogStock,
  syncCatalogInventory,
} from "../catalog-stock";

const tx = {
  inventory: { upsert: mocks.upsert },
  inventoryLot: { aggregate: mocks.lots },
  inventoryMovement: { createMany: mocks.movements },
} as unknown as Prisma.TransactionClient;
const input = {
  productId: "product-1",
  pharmacyId: "unit-1",
  minStock: 5,
  offer: {
    price: "10.00",
    promoPrice: null,
    costPrice: null,
    sku: null,
    ean: null,
  },
  reason: "Contagem CSV",
  actor: { id: "admin-1" },
};

describe("contagem de estoque pelo catálogo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.upsert.mockResolvedValue({ id: "inventory-1", stock: 10 });
    mocks.lots.mockResolvedValue({ _sum: { qty: 8 } });
  });

  it("editar somente a oferta preserva o saldo atual", async () => {
    expect(await syncCatalogInventory(tx, input)).toEqual({
      id: "inventory-1",
      stock: 10,
    });
    expect(mocks.upsert.mock.calls[0][0].update).not.toHaveProperty("stock");
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("uma contagem idêntica não duplica o livro razão", async () => {
    await syncCatalogInventory(tx, { ...input, stock: 10 });
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("recusa consumir lotes por uma contagem genérica", async () => {
    await expect(
      syncCatalogInventory(tx, { ...input, stock: 7 }),
    ).rejects.toThrow(/baixa no lote/);
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("registra somente a diferença e preserva o ator", async () => {
    await syncCatalogInventory(tx, { ...input, stock: 8 });
    expect(mocks.change).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        delta: -2,
        actor: { id: "admin-1" },
        referenceType: "CATALOG_STOCK",
      }),
    );
    expect(mocks.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.lots.mock.invocationCallOrder[0],
    );
  });

  it.each([-1, 1.5, NaN, Infinity, 2_147_483_648])(
    "recusa contagem inválida %s antes de tocar o banco",
    async (stock) => {
      await expect(
        syncCatalogInventory(tx, { ...input, stock }),
      ).rejects.toThrow(/inválida/);
      expect(mocks.upsert).not.toHaveBeenCalled();
    },
  );

  it("grava o estoque inicial em lote e ignora unidades zeradas", async () => {
    await recordInitialCatalogStock(
      tx,
      [
        { productId: "p1", pharmacyId: "matrix", stock: 4 },
        { productId: "p1", pharmacyId: "branch", stock: 0 },
      ],
      input.actor,
    );
    expect(mocks.movements).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productId: "p1",
          pharmacyId: "matrix",
          delta: 4,
          stockBefore: 0,
          stockAfter: 4,
          actorId: "admin-1",
        }),
      ],
    });
  });

  it("não aceita estoque inicial fracionado", async () => {
    await expect(
      recordInitialCatalogStock(
        tx,
        [{ productId: "p1", pharmacyId: "matrix", stock: 0.5 }],
        null,
      ),
    ).rejects.toThrow(/inválido/);
    expect(mocks.movements).not.toHaveBeenCalled();
  });
});
