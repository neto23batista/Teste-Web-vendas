import { describe, it, expect, vi, beforeEach } from "vitest";

const orderFindUnique = vi.fn();
const orderUpdateMany = vi.fn();
const reservationFindMany = vi.fn();
const redemptionFindUnique = vi.fn();
const redemptionDeleteMany = vi.fn();
const couponUpdateMany = vi.fn();
const paymentUpdate = vi.fn();

const tx = {
  order: { updateMany: orderUpdateMany },
  inventoryReservation: { findMany: reservationFindMany },
  couponRedemption: {
    findUnique: redemptionFindUnique,
    deleteMany: redemptionDeleteMany,
  },
  coupon: { updateMany: couponUpdateMany },
  payment: { update: paymentUpdate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: (...a: unknown[]) => orderFindUnique(...a) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

vi.mock("next/cache", () => ({ revalidateTag: () => {} }));

import { cancelOrder } from "@/lib/orders";

// Pedido PENDING: não teve baixa de estoque, então o cancelamento não precisa
// devolver nada ao inventário e o teste isola o caminho do cupom.
const pendingOrder = {
  id: "o1",
  number: "FV-1",
  status: "PENDING",
  pharmacyId: "m",
  userId: "u1",
  couponCode: "BEMVINDO10",
  items: [{ productId: "p1", name: "Dipirona", qty: 1 }],
  payment: null,
  loyaltyTx: [],
};

beforeEach(() => {
  orderFindUnique.mockReset();
  orderUpdateMany.mockReset();
  reservationFindMany.mockReset();
  redemptionFindUnique.mockReset();
  redemptionDeleteMany.mockReset();
  couponUpdateMany.mockReset();
  paymentUpdate.mockReset();

  orderFindUnique.mockResolvedValue(pendingOrder);
  orderUpdateMany.mockResolvedValue({ count: 1 });
  reservationFindMany.mockResolvedValue([]);
  redemptionDeleteMany.mockResolvedValue({ count: 1 });
  couponUpdateMany.mockResolvedValue({ count: 1 });
});

describe("devolução do cupom no cancelamento", () => {
  it("devolve a unidade pelo couponId da redenção, não pelo código gravado", async () => {
    // O cupom foi renomeado depois da compra: o texto no pedido não existe mais.
    redemptionFindUnique.mockResolvedValue({ couponId: "cup-1" });

    await cancelOrder("o1");

    expect(couponUpdateMany).toHaveBeenCalledTimes(1);
    const where = couponUpdateMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ id: "cup-1", usedCount: { gt: 0 } });
    // O código histórico não pode aparecer no filtro: é ele que erra o alvo.
    expect(where).not.toHaveProperty("code");
  });

  it("não devolve nada quando o pedido não consumiu cupom", async () => {
    redemptionFindUnique.mockResolvedValue(null);

    await cancelOrder("o1");

    expect(redemptionDeleteMany).not.toHaveBeenCalled();
    expect(couponUpdateMany).not.toHaveBeenCalled();
  });

  it("não devolve duas vezes quando outra chamada já apagou a redenção", async () => {
    redemptionFindUnique.mockResolvedValue({ couponId: "cup-1" });
    // O DELETE condicional é quem arbitra a corrida entre os dois caminhos de
    // cancelamento (cliente e admin): quem não apagou, não devolve.
    redemptionDeleteMany.mockResolvedValue({ count: 0 });

    await cancelOrder("o1");

    expect(couponUpdateMany).not.toHaveBeenCalled();
  });
});
