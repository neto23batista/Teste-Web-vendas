import { describe, it, expect, vi, beforeEach } from "vitest";

import { reconcileLotsAfterUntrackedDecrease } from "@/lib/inventory/lot-consumption";

const findMany = vi.fn();
const updateMany = vi.fn();
const tx = { inventoryLot: { findMany, updateMany } } as never;

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
});

const lot = (id: string, qty: number) => ({ id, qty });

describe("realinhamento de lote após baixa fora do fluxo de reservas", () => {
  it("não toca em nada quando os lotes já cabem no estoque", async () => {
    findMany.mockResolvedValue([lot("a", 3)]);

    const consumed = await reconcileLotsAfterUntrackedDecrease(tx, {
      productId: "p1",
      pharmacyId: "u1",
      stockAfter: 5,
    });

    expect(consumed).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("unidade sem lote rastreado é caso comum e sai sem escrita", async () => {
    findMany.mockResolvedValue([]);

    expect(
      await reconcileLotsAfterUntrackedDecrease(tx, {
        productId: "p1",
        pharmacyId: "u1",
        stockAfter: 0,
      }),
    ).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("consome só o excesso, começando pelo lote que vence primeiro", async () => {
    // findMany já devolve em ordem FEFO; estoque caiu de 10 para 7.
    findMany.mockResolvedValue([lot("vence-antes", 4), lot("vence-depois", 6)]);

    const consumed = await reconcileLotsAfterUntrackedDecrease(tx, {
      productId: "p1",
      pharmacyId: "u1",
      stockAfter: 7,
    });

    expect(consumed).toBe(3);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "vence-antes", qty: { gte: 3 } },
      data: { qty: { decrement: 3 } },
    });
  });

  it("avança para o próximo lote quando o primeiro não cobre o excesso", async () => {
    findMany.mockResolvedValue([lot("vence-antes", 2), lot("vence-depois", 6)]);

    const consumed = await reconcileLotsAfterUntrackedDecrease(tx, {
      productId: "p1",
      pharmacyId: "u1",
      stockAfter: 3,
    });

    expect(consumed).toBe(5);
    expect(updateMany.mock.calls.map((call) => call[0].where.id)).toEqual([
      "vence-antes",
      "vence-depois",
    ]);
    expect(updateMany.mock.calls[1]![0].data).toEqual({ qty: { decrement: 3 } });
  });

  it("não força a baixa quando o lote mudou sob os pés", async () => {
    findMany.mockResolvedValue([lot("a", 4)]);
    updateMany.mockResolvedValue({ count: 0 });

    // Nada foi consumido, mas também não geramos saldo negativo de lote.
    expect(
      await reconcileLotsAfterUntrackedDecrease(tx, {
        productId: "p1",
        pharmacyId: "u1",
        stockAfter: 1,
      }),
    ).toBe(0);
  });
});
