import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), cart: vi.fn(), addresses: vi.fn(), loyalty: vi.fn(), profile: vi.fn(),
  shipping: vi.fn(), payment: vi.fn(), km: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUserPage: mocks.user }));
vi.mock("@/lib/commerce/cart", () => ({ getCart: mocks.cart }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  address: { findMany: mocks.addresses }, loyaltyAccount: { findUnique: mocks.loyalty },
  user: { findUnique: mocks.profile },
} }));
vi.mock("@/lib/settings", () => ({
  getShippingConfig: mocks.shipping, getPaymentSettings: mocks.payment, resolveKm: mocks.km,
}));

import { getCheckoutView } from "./checkout";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "customer-1" });
  mocks.cart.mockResolvedValue({ items: [{ id: "item-1" }], pharmacyId: "unit-1", subtotal: 100 });
  mocks.addresses.mockResolvedValue([{ id: "address-1", zip: "12345000" }]);
  mocks.loyalty.mockResolvedValue({ points: 30 });
  mocks.profile.mockResolvedValue({ cpf: "" });
  mocks.shipping.mockResolvedValue({ freeMin: 10, freeRadiusKm: 4, perKm: 1, expressFlat: 5, defaultKm: 0 });
  mocks.km.mockResolvedValue(3);
  mocks.payment.mockResolvedValue({ stripeSecretKey: "sk_test_secret", stripeWebhookSecret: "whsec_secret", stripePixEnabled: true, stripeLive: false });
});

describe("checkout query boundary", () => {
  it("binds addresses, loyalty and delivery estimates to the authenticated customer and cart unit", async () => {
    const view = await getCheckoutView();
    expect(mocks.addresses).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "customer-1" } }));
    expect(mocks.loyalty).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "customer-1" } }));
    expect(mocks.km).toHaveBeenCalledWith("12345000", "unit-1");
    expect(view?.deliveryOptionsByAddress["address-1"]).toHaveLength(2);
    expect(view?.maxRedeemDiscount).toBe(1.5);
  });

  it("exposes payment availability, never provider credentials or the customer CPF", async () => {
    const view = await getCheckoutView();
    expect(view?.availability).toEqual({ stripeConfigured: true, pixEnabled: true });
    expect(view?.hasCpf).toBe(false);
    expect(JSON.stringify(view)).not.toMatch(/sk_test_secret|whsec_secret/);
    expect(view).not.toHaveProperty("cpf");
  });

  it("skips private queries when the cart is empty", async () => {
    mocks.cart.mockResolvedValue({ items: [] });
    expect(await getCheckoutView()).toBeNull();
    expect(mocks.addresses).not.toHaveBeenCalled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
});
