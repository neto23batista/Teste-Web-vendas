import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ changeInventory: vi.fn() }));
vi.mock("@/lib/inventory/movements", () => ({
  changeInventory: mocks.changeInventory,
}));

import {
  ReturnDispositionError,
  findOriginLots,
  planRestock,
  restockToOriginLots,
} from "@/lib/returns/quarantine";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const lotDate = (days: number) => {
  const value = new Date(NOW);
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(12, 0, 0, 0);
  return value;
};

const lot = (lotCode: string, soldQty: number, days: number) => ({
  lotId: `lot-${lotCode}`,
  lotCode,
  expiresAt: lotDate(days),
  soldQty,
});

describe("origem do lote de um item vendido", () => {
  const reservationFindUnique = vi.fn();
  const tx = {
    inventoryReservation: { findUnique: reservationFindUnique },
  } as never;

  beforeEach(() => reservationFindUnique.mockReset());

  it("devolve os lotes na ordem em que a venda os consumiu", async () => {
    reservationFindUnique.mockResolvedValue({
      allocations: [
        { qty: 2, lot: { id: "l2", lotCode: "TARDE", expiresAt: lotDate(90) } },
        { qty: 3, lot: { id: "l1", lotCode: "CEDO", expiresAt: lotDate(30) } },
      ],
    });

    expect(await findOriginLots(tx, "order-item-1")).toEqual([
      { lotId: "l1", lotCode: "CEDO", expiresAt: lotDate(30), soldQty: 3 },
      { lotId: "l2", lotCode: "TARDE", expiresAt: lotDate(90), soldQty: 2 },
    ]);
  });

  it("pedido sem reserva não tem origem rastreável", async () => {
    reservationFindUnique.mockResolvedValue(null);
    expect(await findOriginLots(tx, "pedido-legado")).toEqual([]);
  });
});

describe("plano de reposição ao lote de origem", () => {
  it("recusa quando não há lote rastreável — o buraco que deixava voltar sem rastro", () => {
    expect(() => planRestock([], 1, NOW)).toThrow(ReturnDispositionError);
    expect(() => planRestock([], 1, NOW)).toThrow(/sem lote de origem rastreável/i);
  });

  it("recusa quando o lote de origem já venceu", () => {
    expect(() => planRestock([lot("VENCIDO", 3, -1)], 1, NOW)).toThrow(
      /vencido/i,
    );
  });

  it("aceita o lote que vence hoje — validade é data civil, não instante", () => {
    expect(planRestock([lot("HOJE", 2, 0)], 2, NOW)).toEqual([
      { lotId: "lot-HOJE", lotCode: "HOJE", qty: 2 },
    ]);
  });

  it("devolve na ordem FEFO e só até o que cada lote forneceu", () => {
    const plan = planRestock([lot("CEDO", 3, 30), lot("TARDE", 4, 90)], 5, NOW);
    expect(plan).toEqual([
      { lotId: "lot-CEDO", lotCode: "CEDO", qty: 3 },
      { lotId: "lot-TARDE", lotCode: "TARDE", qty: 2 },
    ]);
  });

  it("recusa devolver mais do que saiu do lote", () => {
    expect(() => planRestock([lot("CEDO", 2, 30)], 3, NOW)).toThrow(
      /maior do que saiu/i,
    );
  });

  it("recusa quantidade zero ou negativa", () => {
    expect(() => planRestock([lot("CEDO", 2, 30)], 0, NOW)).toThrow(
      ReturnDispositionError,
    );
  });
});

describe("execução da reposição", () => {
  const lotUpdate = vi.fn();
  const tx = { inventoryLot: { update: lotUpdate } } as never;

  beforeEach(() => {
    lotUpdate.mockReset();
    mocks.changeInventory.mockReset();
  });

  it("repõe o lote E o estoque agregado na mesma transação", async () => {
    await restockToOriginLots(tx, {
      productId: "p1",
      pharmacyId: "u1",
      plan: [
        { lotId: "l1", lotCode: "CEDO", qty: 3 },
        { lotId: "l2", lotCode: "TARDE", qty: 2 },
      ],
      reason: "Devolução liberada",
      referenceId: "ret-1",
      actor: null,
    });

    // As duas pontas andam juntas: mexer só no estoque foi o que criou saldo
    // vendável sem lote.
    expect(lotUpdate.mock.calls.map((call) => call[0])).toEqual([
      { where: { id: "l1" }, data: { qty: { increment: 3 } } },
      { where: { id: "l2" }, data: { qty: { increment: 2 } } },
    ]);
    expect(mocks.changeInventory).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ productId: "p1", delta: 5, kind: "RETURN" }),
    );
  });

  it("plano vazio não movimenta nada", async () => {
    await restockToOriginLots(tx, {
      productId: "p1",
      pharmacyId: "u1",
      plan: [],
      reason: "x",
      referenceId: "ret-1",
      actor: null,
    });
    expect(lotUpdate).not.toHaveBeenCalled();
    expect(mocks.changeInventory).not.toHaveBeenCalled();
  });
});
