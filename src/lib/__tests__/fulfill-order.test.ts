import { describe, it, expect, vi, beforeEach } from "vitest";

const orderFindUnique = vi.fn();
const orderCreate = vi.fn();
const orderUpdateMany = vi.fn();
const txOrderFindUnique = vi.fn();
const txOrderCreate = vi.fn();
const inventoryUpdateMany = vi.fn();
const inventoryFindMany = vi.fn();
const paymentUpdateMany = vi.fn();
const loyaltyUpsert = vi.fn();
const loyaltyUpdateMany = vi.fn();
const loyaltyTxCreate = vi.fn();
const couponUpdateMany = vi.fn();

const tx = {
  order: {
    findUnique: txOrderFindUnique,
    create: txOrderCreate,
    updateMany: orderUpdateMany,
  },
  inventory: { updateMany: inventoryUpdateMany },
  payment: { updateMany: paymentUpdateMany },
  loyaltyAccount: { upsert: loyaltyUpsert, updateMany: loyaltyUpdateMany },
  loyaltyTransaction: { create: loyaltyTxCreate },
  coupon: { updateMany: couponUpdateMany },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: (...a: unknown[]) => orderFindUnique(...a),
      create: (...a: unknown[]) => orderCreate(...a),
    },
    inventory: { findMany: (...a: unknown[]) => inventoryFindMany(...a) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

vi.mock("next/cache", () => ({ revalidateTag: () => {} }));

import {
  createOrder,
  createCheckoutOrder,
  fulfillOrder,
  markOrderDelivered,
  type CreateInput,
} from "@/lib/orders";

const pendingOrder = {
  id: "o1",
  number: "FV-1",
  status: "PENDING",
  pharmacyId: "m",
  userId: "u1",
  subtotal: 80,
  discount: 0,
  shipping: 0,
  total: 80,
  paymentMethod: "card",
  items: [{ productId: "p1", name: "Dipirona", price: 40, qty: 2 }],
};

const validCreateInput: CreateInput = {
  userId: "u1",
  addressId: "a1",
  customer: {
    name: "Cliente Teste",
    email: "cliente@example.com",
    cpf: null,
    phone: null,
  },
  shippingAddress: {
    recipient: "Cliente Teste",
    zip: "01001-000",
    street: "Praça da Sé",
    number: "1",
    complement: null,
    district: "Sé",
    city: "São Paulo",
    state: "SP",
  },
  pharmacyId: "m",
  paymentMethod: "card",
  subtotal: 80,
  shipping: 0,
  discount: 0,
  total: 80,
  couponCode: null,
  items: [{ productId: "p1", name: "Dipirona", price: 40, qty: 2 }],
};

beforeEach(() => {
  orderFindUnique.mockReset();
  orderCreate.mockReset();
  orderUpdateMany.mockReset();
  txOrderFindUnique.mockReset();
  txOrderCreate.mockReset();
  inventoryUpdateMany.mockReset();
  inventoryFindMany.mockReset();
  paymentUpdateMany.mockReset();
  loyaltyUpsert.mockReset();
  loyaltyUpdateMany.mockReset();
  loyaltyTxCreate.mockReset();
  couponUpdateMany.mockReset();

  orderFindUnique.mockResolvedValue(pendingOrder);
  inventoryUpdateMany.mockResolvedValue({ count: 1 });
  inventoryFindMany.mockResolvedValue([]); // sem alerta de baixo estoque
  paymentUpdateMany.mockResolvedValue({ count: 1 });
  loyaltyUpsert.mockResolvedValue({ id: "acc1" });
  loyaltyUpdateMany.mockResolvedValue({ count: 1 });
  couponUpdateMany.mockResolvedValue({ count: 1 });
  txOrderFindUnique.mockResolvedValue(null);
  txOrderCreate.mockResolvedValue({
    ...pendingOrder,
    checkoutKey: "attempt-key",
  });
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
    expect(loyaltyUpsert).not.toHaveBeenCalled();
    expect(loyaltyTxCreate).not.toHaveBeenCalled();
  });

  it("rejeita pedido legado com quantidade negativa antes de tocar no estoque", async () => {
    orderFindUnique.mockResolvedValue({
      ...pendingOrder,
      subtotal: -80,
      total: -80,
      items: [{ ...pendingOrder.items[0], qty: -2 }],
    });

    await expect(fulfillOrder("o1")).rejects.toThrow(/quantidade inválida/i);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
    expect(loyaltyUpsert).not.toHaveBeenCalled();
  });

  it("rejeita pedido com total divergente antes de confirmar", async () => {
    orderFindUnique.mockResolvedValue({ ...pendingOrder, total: 1 });

    await expect(fulfillOrder("o1")).rejects.toThrow(/total diverge/i);
    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
  });
});

describe("markOrderDelivered", () => {
  it("aprova dinheiro e credita pontos somente quando a entrega é confirmada", async () => {
    orderFindUnique.mockResolvedValue({
      ...pendingOrder,
      status: "SHIPPED",
      paymentMethod: "cash",
    });

    await expect(markOrderDelivered("o1")).resolves.toBe(true);

    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: {
        orderId: "o1",
        provider: "CASH",
        status: "PENDING",
      },
      data: { status: "APPROVED", failureReason: null, failedAt: null },
    });
    expect(loyaltyUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { points: { increment: 80 } } })
    );
  });

  it("perde a corrida de entrega sem aprovar dinheiro ou duplicar pontos", async () => {
    orderFindUnique.mockResolvedValue({
      ...pendingOrder,
      status: "SHIPPED",
      paymentMethod: "cash",
    });
    orderUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(markOrderDelivered("o1")).resolves.toBe(false);

    expect(paymentUpdateMany).not.toHaveBeenCalled();
    expect(loyaltyUpsert).not.toHaveBeenCalled();
  });
});

describe("createOrder", () => {
  it("não persiste quantidade negativa", async () => {
    const malicious = {
      ...validCreateInput,
      subtotal: -80,
      total: -80,
      items: [{ ...validCreateInput.items[0], qty: -2 }],
    };

    await expect(createOrder(malicious)).rejects.toThrow(/quantidade inválida/i);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("não persiste subtotal divergente das linhas", async () => {
    await expect(
      createOrder({ ...validCreateInput, subtotal: 1, total: 1 })
    ).rejects.toThrow(/subtotal diverge/i);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("registra Stripe como provedor real dos pagamentos online", async () => {
    orderCreate.mockResolvedValue(pendingOrder);
    await createOrder(validCreateInput);
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: "80.00",
          total: "80.00",
          customerName: "Cliente Teste",
          customerEmail: "cliente@example.com",
          shippingRecipient: "Cliente Teste",
          shippingZip: "01001-000",
          shippingStreet: "Praça da Sé",
          payment: { create: expect.objectContaining({ provider: "STRIPE" }) },
        }),
      })
    );
  });
});

describe("createCheckoutOrder", () => {
  it("reserva pontos/cupom e cria pedido dentro da mesma transação", async () => {
    const result = await createCheckoutOrder(
      { ...validCreateInput, couponCode: "BEMVINDO" },
      {
        checkoutKey: "attempt-key",
        loyaltyAccountId: "acc1",
        redeemPoints: 10,
        couponUsageLimit: 100,
      }
    );

    expect(loyaltyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { points: { decrement: 10 } } })
    );
    expect(couponUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { usedCount: { increment: 1 } } })
    );
    expect(txOrderCreate).toHaveBeenCalledTimes(1);
    expect(loyaltyTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: -10 }) })
    );
    expect(result.created).toBe(true);
  });

  it("replay da mesma tentativa devolve o pedido sem consumir reservas novamente", async () => {
    txOrderFindUnique.mockResolvedValue({
      ...pendingOrder,
      checkoutKey: "attempt-key",
    });

    const result = await createCheckoutOrder(validCreateInput, {
      checkoutKey: "attempt-key",
      loyaltyAccountId: "acc1",
      redeemPoints: 10,
      couponUsageLimit: null,
    });

    expect(result.created).toBe(false);
    expect(loyaltyUpdateMany).not.toHaveBeenCalled();
    expect(couponUpdateMany).not.toHaveBeenCalled();
    expect(txOrderCreate).not.toHaveBeenCalled();
  });
});
