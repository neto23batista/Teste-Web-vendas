import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  refundPayment: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    returnRequest: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));
vi.mock("@/lib/stripe", () => ({ refundPayment: mocks.refundPayment }));

import { settleReturnRefund } from "@/lib/return-refunds";

function receivedRequest(provider: "STRIPE" | "CASH" = "STRIPE") {
  return {
    id: "return-1",
    status: "RECEIVED",
    refundStatus: "PENDING",
    approvedAmount: 20,
    order: {
      number: "FV-1",
      payment: {
        provider,
        status: provider === "STRIPE" ? "APPROVED" : "PENDING",
        externalId: provider === "STRIPE" ? "pi_1" : null,
        amount: 100,
      },
      returnRequests: [],
    },
  };
}

describe("liquidação de devolução", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(receivedRequest());
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.refundPayment.mockResolvedValue({
      ok: true,
      refundId: "re_1",
      status: "succeeded",
    });
  });

  it("pede estorno parcial com chave idempotente da devolução", async () => {
    const result = await settleReturnRefund("return-1");

    expect(result).toEqual({ ok: true });
    expect(mocks.refundPayment).toHaveBeenCalledWith("pi_1", "FV-1", {
      amountCents: 2_000,
      returnId: "return-1",
      idempotencyKey: "return-refund-return-1",
    });
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: { id: "return-1", refundStatus: "PROCESSING" },
      data: expect.objectContaining({
        status: "COMPLETED",
        refundStatus: "SUCCEEDED",
        refundId: "re_1",
      }),
    });
  });

  it("conclui dinheiro na entrega sem inventar uma chamada ao Stripe", async () => {
    mocks.findUnique.mockResolvedValue(receivedRequest("CASH"));

    await expect(settleReturnRefund("return-1")).resolves.toEqual({ ok: true });

    expect(mocks.refundPayment).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "return-1", status: "RECEIVED" }),
      data: expect.objectContaining({ status: "COMPLETED", refundStatus: "SUCCEEDED" }),
    });
  });

  it("recusa estornar além do saldo restante do pagamento", async () => {
    mocks.findUnique.mockResolvedValue({
      ...receivedRequest(),
      approvedAmount: 80,
      order: {
        ...receivedRequest().order,
        returnRequests: [{ approvedAmount: 30 }],
      },
    });

    await expect(settleReturnRefund("return-1")).resolves.toEqual({
      ok: false,
      error: "O valor aprovado ultrapassa o saldo reembolsável.",
    });
    expect(mocks.refundPayment).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundStatus: "FAILED" }),
      })
    );
  });
});
