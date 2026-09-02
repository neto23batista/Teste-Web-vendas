import { describe, it, expect, vi, beforeEach } from "vitest";

const orderFindUnique = vi.fn();
const pharmacyFindFirst = vi.fn();
const inventoryUpdateMany = vi.fn();
const inventoryFindUnique = vi.fn();
const inventoryUpsert = vi.fn();
const inventoryMovementCreate = vi.fn();
const inventoryReservationFindMany = vi.fn();
const orderUpdate = vi.fn();

const tx = {
  inventory: {
    updateMany: inventoryUpdateMany,
    findUnique: inventoryFindUnique,
    upsert: inventoryUpsert,
  },
  inventoryMovement: { create: inventoryMovementCreate },
  inventoryReservation: { findMany: inventoryReservationFindMany },
  order: { update: orderUpdate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: (...a: unknown[]) => orderFindUnique(...a) },
    pharmacy: { findFirst: (...a: unknown[]) => pharmacyFindFirst(...a) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

// revalidateTag é no-op nos testes (fora do runtime do Next).
vi.mock("next/cache", () => ({ revalidateTag: () => {} }));

import { transferOrder } from "@/lib/orders";

const baseOrder = (status: string) => ({
  id: "o1",
  number: "FV-1",
  status,
  pharmacyId: "m",
  notes: null,
  items: [{ productId: "p1", name: "Dipirona", qty: 2 }],
  pharmacy: { name: "Matriz" },
});

beforeEach(() => {
  orderFindUnique.mockReset();
  pharmacyFindFirst.mockReset();
  inventoryUpdateMany.mockReset();
  inventoryFindUnique.mockReset();
  inventoryUpsert.mockReset();
  inventoryMovementCreate.mockReset();
  inventoryReservationFindMany.mockReset();
  orderUpdate.mockReset();
  pharmacyFindFirst.mockResolvedValue({ id: "f", name: "Filial" });
  inventoryUpdateMany.mockResolvedValue({ count: 1 });
  inventoryFindUnique.mockResolvedValue({ id: "inv-target", stock: 8 });
  inventoryUpsert.mockResolvedValue({ id: "inv-source", stock: 12 });
  inventoryReservationFindMany.mockResolvedValue([]);
});

describe("transferOrder", () => {
  it("PENDING: só troca a unidade, sem mexer no estoque", async () => {
    orderFindUnique.mockResolvedValue(baseOrder("PENDING"));
    await transferOrder("o1", "f");
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pharmacyId: "f" }) })
    );
  });

  it("PAID com estoque no destino: baixa do destino, devolve à origem e troca a unidade", async () => {
    orderFindUnique.mockResolvedValue(baseOrder("PAID"));
    await transferOrder("o1", "f");
    // 1ª chamada: decrementa o destino (filial)
    expect(inventoryUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { productId: "p1", pharmacyId: "f", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    // A devolução à origem usa upsert atômico e também grava o livro-razão.
    expect(inventoryUpsert).toHaveBeenCalledWith({
      where: { productId_pharmacyId: { productId: "p1", pharmacyId: "m" } },
      create: expect.objectContaining({ productId: "p1", pharmacyId: "m", stock: 2 }),
      update: { stock: { increment: 2 } },
      select: { id: true, stock: true },
    });
    expect(inventoryMovementCreate).toHaveBeenCalledTimes(2);
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pharmacyId: "f" }) })
    );
  });

  it("PAID sem estoque no destino: lança erro e NÃO troca a unidade", async () => {
    orderFindUnique.mockResolvedValue(baseOrder("PAID"));
    inventoryUpdateMany.mockResolvedValue({ count: 0 }); // destino sem estoque
    await expect(transferOrder("o1", "f")).rejects.toThrow(/insuficiente/i);
    expect(orderUpdate).not.toHaveBeenCalled();
  });
});
