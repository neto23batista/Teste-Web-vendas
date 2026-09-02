import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  stripeEventCreate: vi.fn(),
  stripeEventFindUnique: vi.fn(),
  stripeEventUpdateMany: vi.fn(),
  orderFindUnique: vi.fn(),
  confirmStripePayment: vi.fn(),
  failStripePayment: vi.fn(),
  recordStripeRefund: vi.fn(),
  recordStripeReturnRefund: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stripeEvent: {
      create: mocks.stripeEventCreate,
      findUnique: mocks.stripeEventFindUnique,
      updateMany: mocks.stripeEventUpdateMany,
    },
    order: { findUnique: mocks.orderFindUnique },
  },
}));
vi.mock("@/lib/payments/stripe", () => ({
  getStripeForWebhook: vi.fn().mockResolvedValue({
    client: { webhooks: { constructEvent: mocks.constructEvent } },
    webhookSecret: "whsec_test",
  }),
}));
vi.mock("@/lib/orders", () => ({
  confirmStripePayment: mocks.confirmStripePayment,
  failStripePayment: mocks.failStripePayment,
  recordStripeRefund: mocks.recordStripeRefund,
}));
vi.mock("@/lib/payments/return-refunds", () => ({
  recordStripeReturnRefund: mocks.recordStripeReturnRefund,
}));
vi.mock("@/lib/monitoring", () => ({ reportError: mocks.reportError }));

import { POST } from "@/app/api/webhooks/stripe/route";

function request(body = "{}") {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "signature" },
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stripeEventCreate.mockResolvedValue({});
    mocks.stripeEventUpdateMany.mockResolvedValue({ count: 1 });
    mocks.orderFindUnique.mockResolvedValue({ id: "order-1", total: 100 });
    mocks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_1",
          metadata: { orderNumber: "FV-1" },
          amount_received: 10_000,
          currency: "brl",
        },
      },
    });
  });

  it("registra e conclui o evento antes de responder sucesso", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.confirmStripePayment).toHaveBeenCalledWith("order-1", "pi_1");
    expect(mocks.stripeEventCreate).toHaveBeenCalledWith({
      data: {
        id: "evt_1",
        type: "payment_intent.succeeded",
        payloadSha256: createHash("sha256").update("{}").digest("hex"),
      },
    });
    expect(mocks.stripeEventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) })
    );
  });

  it("não reaplica um evento que já terminou", async () => {
    mocks.stripeEventCreate.mockRejectedValue({ code: "P2002" });
    mocks.stripeEventFindUnique.mockResolvedValue({
      id: "evt_1",
      payloadSha256: createHash("sha256").update("{}").digest("hex"),
      status: "PROCESSED",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(mocks.confirmStripePayment).not.toHaveBeenCalled();
  });

  it("recusa reutilização do event.id com outro payload", async () => {
    mocks.stripeEventCreate.mockRejectedValue({ code: "P2002" });
    mocks.stripeEventFindUnique.mockResolvedValue({
      id: "evt_1",
      payloadSha256: "0".repeat(64),
      status: "PROCESSED",
    });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.confirmStripePayment).not.toHaveBeenCalled();
  });
});
