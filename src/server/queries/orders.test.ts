import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserPage: vi.fn(), order: vi.fn(), redirect: vi.fn(),
  readPixRaw: vi.fn(), readCheckoutRaw: vi.fn(), qrPngBase64: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ requireUserPage: mocks.requireUserPage }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique: mocks.order } } }));
vi.mock("@/lib/payments/stripe", () => ({ readPixRaw: mocks.readPixRaw, readCheckoutRaw: mocks.readCheckoutRaw }));
vi.mock("@/lib/qrcode", () => ({ qrPngBase64: mocks.qrPngBase64 }));

import { getCustomerOrderView } from "./orders";

function fixture() {
  return {
    id: "order-1", userId: "customer-1", number: "FV-123", status: "PENDING",
    subtotal: "19.90", discount: "1.00", shipping: "5.00", total: "23.90",
    paymentMethod: "card", items: [{ id: "item-1", name: "Produto", qty: 1, price: "19.90" }],
    payment: { status: "PENDING", raw: { secret: "must-not-cross-the-query" } },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUserPage.mockResolvedValue({ id: "customer-1", role: "CUSTOMER" });
  mocks.order.mockResolvedValue(fixture());
  mocks.readPixRaw.mockReturnValue(null);
  mocks.readCheckoutRaw.mockReturnValue(null);
});

describe("customer order query boundary", () => {
  it("does not access order data before the session guard succeeds", async () => {
    mocks.requireUserPage.mockRejectedValue(new Error("login required"));
    await expect(getCustomerOrderView("FV-123")).rejects.toThrow("login required");
    expect(mocks.order).not.toHaveBeenCalled();
  });

  it("returns no details, payment or QR for a different customer", async () => {
    mocks.order.mockResolvedValue({ ...fixture(), userId: "another-customer" });
    expect(await getCustomerOrderView("FV-123")).toBeNull();
    expect(mocks.readPixRaw).not.toHaveBeenCalled();
    expect(mocks.readCheckoutRaw).not.toHaveBeenCalled();
  });

  it("normalizes money and excludes payment payload and customer identity from the view", async () => {
    const view = await getCustomerOrderView("FV-123");
    expect(view?.order.total).toBe(23.9);
    expect(view?.order.items[0].price).toBe(19.9);
    expect(view?.order.payment).toEqual({ status: "PENDING" });
    expect(view?.order).not.toHaveProperty("userId");
    expect(JSON.stringify(view)).not.toContain("must-not-cross-the-query");
  });

  it("does not offer a second payment for a quarantined charge", async () => {
    mocks.order.mockResolvedValue({ ...fixture(), payment: { status: "QUARANTINED", raw: {} } });
    mocks.readCheckoutRaw.mockReturnValue({ sessionId: "cs_test", url: "https://checkout.stripe.com/test", expiresAt: null });
    const view = await getCustomerOrderView("FV-123");
    expect(view?.awaitingPayment).toBe(false);
    expect(view?.cardCheckout).toBeNull();
    expect(view?.pix).toBeNull();
    expect(view?.live).toBe(true);
  });

  it("keeps observing a canceled order until its refund settles", async () => {
    mocks.order.mockResolvedValue({ ...fixture(), status: "CANCELED", payment: { status: "REFUND_PENDING", raw: {} } });
    expect((await getCustomerOrderView("FV-123"))?.live).toBe(true);
    mocks.order.mockResolvedValue({ ...fixture(), status: "CANCELED", payment: { status: "REFUNDED", raw: {} } });
    expect((await getCustomerOrderView("FV-123"))?.live).toBe(false);
  });

  it("does not resume malformed or expired hosted checkouts", async () => {
    mocks.readCheckoutRaw.mockReturnValue({ sessionId: "cs_test", url: "https://checkout.stripe.com/test", expiresAt: "invalid" });
    expect((await getCustomerOrderView("FV-123"))?.cardCheckout).toBeNull();
  });
});
