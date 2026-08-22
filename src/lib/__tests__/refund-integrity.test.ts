import { beforeEach, describe, expect, it, vi } from "vitest";

const paymentFindUnique = vi.fn();
const paymentUpdateMany = vi.fn();
const refundPayment = vi.fn();
const orderFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: {
      findUnique: (...args: unknown[]) => paymentFindUnique(...args),
      updateMany: (...args: unknown[]) => paymentUpdateMany(...args),
    },
    order: {
      findUnique: (...args: unknown[]) => orderFindUnique(...args),
    },
  },
}));
vi.mock("next/cache", () => ({ revalidateTag: () => {} }));
vi.mock("@/lib/stripe", () => ({
  refundPayment: (...args: unknown[]) => refundPayment(...args),
}));

import { confirmStripePayment, processOrderRefund } from "@/lib/orders";

const approvedPayment = {
  id: "pay-1",
  orderId: "order-1",
  provider: "STRIPE",
  status: "APPROVED",
  externalId: "pi_123",
  refundId: null,
  refundError: null,
  refundRequestedAt: null,
  refundedAt: null,
  failureReason: null,
  failedAt: null,
  amount: 80,
  raw: null,
  order: { number: "FV123" },
};

beforeEach(() => {
  paymentFindUnique.mockReset();
  paymentUpdateMany.mockReset();
  refundPayment.mockReset();
  orderFindUnique.mockReset();

  paymentFindUnique.mockResolvedValue(approvedPayment);
  paymentUpdateMany.mockResolvedValue({ count: 1 });
});

describe("pagamento que vence a corrida do cancelamento", () => {
  it("não reabre o pedido cancelado e encaminha o valor ao reembolso", async () => {
    orderFindUnique.mockResolvedValue({ id: "order-1", status: "CANCELED" });
    paymentFindUnique
      .mockResolvedValueOnce({ ...approvedPayment, status: "REFUND_PENDING" })
      .mockResolvedValueOnce({ ...approvedPayment, status: "REFUNDED" });
    refundPayment.mockResolvedValue({
      ok: true,
      refundId: "re_late",
      status: "succeeded",
    });

    await confirmStripePayment("order-1", "pi_123");

    expect(paymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REFUND_PENDING" }),
      })
    );
    expect(refundPayment).toHaveBeenCalledWith("pi_123", "FV123");
    expect(orderFindUnique).toHaveBeenCalledWith({ where: { id: "order-1" } });
  });
});

describe("processOrderRefund", () => {
  it("persiste REFUND_PENDING antes de pedir o estorno e só conclui após o Stripe", async () => {
    paymentFindUnique
      .mockResolvedValueOnce(approvedPayment)
      .mockResolvedValueOnce({ ...approvedPayment, status: "REFUNDED" });
    refundPayment.mockResolvedValue({
      ok: true,
      refundId: "re_123",
      status: "succeeded",
    });

    const result = await processOrderRefund("order-1");

    expect(paymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REFUND_PENDING" }) })
    );
    expect(paymentUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      refundPayment.mock.invocationCallOrder[0]
    );
    expect(refundPayment).toHaveBeenCalledWith("pi_123", "FV123");
    expect(paymentUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "pay-1", status: "REFUND_PENDING" },
        data: expect.objectContaining({
          status: "REFUNDED",
          refundId: "re_123",
        }),
      })
    );
    expect(result?.status).toBe("REFUNDED");
  });

  it("grava REFUND_FAILED quando o provedor recusa ou fica indisponível", async () => {
    paymentFindUnique
      .mockResolvedValueOnce(approvedPayment)
      .mockResolvedValueOnce({ ...approvedPayment, status: "REFUND_FAILED" });
    refundPayment.mockResolvedValue({
      ok: false,
      refundId: null,
      error: "Stripe indisponível",
    });

    const result = await processOrderRefund("order-1");

    expect(paymentUpdateMany).toHaveBeenLastCalledWith({
      where: { id: "pay-1", status: "REFUND_PENDING" },
      data: {
        status: "REFUND_FAILED",
        refundId: null,
        refundError: "Stripe indisponível",
      },
    });
    expect(result?.status).toBe("REFUND_FAILED");
  });

  it("nunca inventa sucesso quando falta o identificador externo", async () => {
    paymentFindUnique
      .mockResolvedValueOnce({ ...approvedPayment, externalId: null })
      .mockResolvedValueOnce({
        ...approvedPayment,
        externalId: null,
        status: "REFUND_FAILED",
      });

    const result = await processOrderRefund("order-1");

    expect(refundPayment).not.toHaveBeenCalled();
    expect(paymentUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "pay-1", status: "REFUND_PENDING" },
        data: expect.objectContaining({ status: "REFUND_FAILED" }),
      })
    );
    expect(result?.status).toBe("REFUND_FAILED");
  });
});
