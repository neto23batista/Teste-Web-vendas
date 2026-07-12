import { describe, it, expect, vi, beforeEach } from "vitest";

const orderFindUnique = vi.fn();
const orderUpdateMany = vi.fn();
const inventoryUpdateMany = vi.fn();
const inventoryFindMany = vi.fn();
const paymentUpdateMany = vi.fn();
const loyaltyUpsert = vi.fn();
const loyaltyTxCreate = vi.fn();

const tx = {
  order: { updateMany: orderUpdateMany },
  inventory: { updateMany: inventoryUpdateMany },
  payment: { updateMany: paymentUpdateMany },
  loyaltyAccount: { upsert: loyaltyUpsert },
  loyaltyTransaction: { create: loyaltyTxCreate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: (...a: unknown[]) => orderFindUnique(...a) },
    inventory: { findMany: (...a: unknown[]) => inventoryFindMany(...a) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

vi.mock("next/cache", () => ({ revalidateTag: () => {} }));

import { fulfillOrder } from "@/lib/orders";

const pendingOrder = {
  id: "o1",
  number: "FV-1",
  status: "PENDING",
  pharmacyId: "m",
  userId: "u1",
  total: 80,
  paymentMethod: "card",
  requiresPrescription: false,
  items: [{ productId: "p1", name: "Dipirona", qty: 2 }],
};

beforeEach(() => {
  orderFindUnique.mockReset();
  orderUpdateMany.mockReset();
  inventoryUpdateMany.mockReset();
  inventoryFindMany.mockReset();
  paymentUpdateMany.mockReset();
  loyaltyUpsert.mockReset();
  loyaltyTxCreate.mockReset();

  orderFindUnique.mockResolvedValue(pendingOrder);
  inventoryUpdateMany.mockResolvedValue({ count: 1 });
  inventoryFindMany.mockResolvedValue([]); // sem alerta de baixo estoque
  loyaltyUpsert.mockResolvedValue({ id: "acc1" });
  orderUpdateMany.mockResolvedValue({ count: 1 }); // reivindicou o pedido
});

describe("fulfillOrder", () => {
  it("reivindica o pedido de forma atômica (só age se ainda estiver PENDING)", async () => {
    await fulfillOrder("o1");
    expect(orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "o1", status: "PENDING" },
        data: { status: "PAID" },
      })
    );
  });

  it("confirma uma vez: baixa estoque, aprova pagamento e credita os pontos", async () => {
    await fulfillOrder("o1");
    expect(inventoryUpdateMany).toHaveBeenCalledTimes(1);
    expect(inventoryUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { productId: "p1", pharmacyId: "m", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(paymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "APPROVED" } })
    );
    expect(loyaltyUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { points: { increment: 80 } } })
    );
  });

  it("webhook duplicado (perde a corrida): NÃO baixa estoque nem credita pontos de novo", async () => {
    // O cartão dispara dois eventos (checkout.session.completed +
    // payment_intent.succeeded) e a entrega é "pelo menos uma vez". Aqui o
    // pedido ainda é lido como PENDING (leitura obsoleta), mas a reivindicação
    // atômica não pega nenhuma linha — outra execução já confirmou.
    orderUpdateMany.mockResolvedValue({ count: 0 });

    await fulfillOrder("o1");

    expect(inventoryUpdateMany).not.toHaveBeenCalled();
    expect(paymentUpdateMany).not.toHaveBeenCalled();
    expect(loyaltyUpsert).not.toHaveBeenCalled();
    expect(loyaltyTxCreate).not.toHaveBeenCalled();
  });

  it("pedido que não está mais PENDING nem chega a abrir transação", async () => {
    orderFindUnique.mockResolvedValue({ ...pendingOrder, status: "PAID" });
    await fulfillOrder("o1");
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(loyaltyUpsert).not.toHaveBeenCalled();
  });

  it("dinheiro na entrega sem receita: vai direto para PREPARING e não aprova o pagamento", async () => {
    orderFindUnique.mockResolvedValue({ ...pendingOrder, paymentMethod: "cash" });
    await fulfillOrder("o1");
    expect(orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PREPARING" } })
    );
    expect(paymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PENDING" } })
    );
  });
});
