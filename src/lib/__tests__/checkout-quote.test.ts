import { beforeEach, describe, expect, it, vi } from "vitest";

const addressFindFirst = vi.fn();
const loyaltyFindUnique = vi.fn();
const validateCoupon = vi.fn();
const getShippingConfig = vi.fn();
const resolveKm = vi.fn();
const shippingForCents = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    address: { findFirst: (...args: unknown[]) => addressFindFirst(...args) },
    loyaltyAccount: {
      findUnique: (...args: unknown[]) => loyaltyFindUnique(...args),
    },
  },
}));
vi.mock("@/lib/coupons", () => ({
  validateCoupon: (...args: unknown[]) => validateCoupon(...args),
}));
vi.mock("@/lib/settings", () => ({
  getShippingConfig: (...args: unknown[]) => getShippingConfig(...args),
  resolveKm: (...args: unknown[]) => resolveKm(...args),
}));
vi.mock("@/lib/shipping", () => ({
  shippingForCents: (...args: unknown[]) => shippingForCents(...args),
}));

import { quoteCheckout } from "@/lib/checkout-quote";

beforeEach(() => {
  addressFindFirst.mockReset();
  loyaltyFindUnique.mockReset();
  validateCoupon.mockReset();
  getShippingConfig.mockReset();
  resolveKm.mockReset();
  shippingForCents.mockReset();

  addressFindFirst.mockResolvedValue({ zip: "01001-000" });
  loyaltyFindUnique.mockResolvedValue({ id: "acc-1", points: 1_000 });
  validateCoupon.mockResolvedValue({
    code: "BEMVINDO10",
    discount: 10,
    usageLimit: 100,
  });
  getShippingConfig.mockResolvedValue({});
  resolveKm.mockResolvedValue(5);
  shippingForCents.mockReturnValue(1_200);
});

describe("quoteCheckout", () => {
  it("combina cupom, teto de pontos, CEP e frete em um total autoritativo", async () => {
    const quote = await quoteCheckout({
      userId: "user-1",
      pharmacyId: "pharmacy-1",
      subtotal: 100,
      addressId: "address-1",
      coupon: "BEMVINDO10",
      requestedRedeemPoints: 1_000,
      deliveryMethod: "express",
    });

    // Após cupom, a base é R$ 90; o resgate limita a 50% = R$ 45 = 900 pts.
    expect(quote).toMatchObject({
      couponCode: "BEMVINDO10",
      couponDiscount: 10,
      redeemPoints: 900,
      redeemDiscount: 45,
      discount: 55,
      shipping: 12,
      total: 57,
      deliveryMethod: "express",
    });
    expect(addressFindFirst).toHaveBeenCalledWith({
      where: { id: "address-1", userId: "user-1" },
      select: { zip: true },
    });
    expect(resolveKm).toHaveBeenCalledWith("01001-000", "pharmacy-1");
  });

  it("não cota endereço salvo de outro usuário", async () => {
    addressFindFirst.mockResolvedValue(null);

    await expect(
      quoteCheckout({
        userId: "user-1",
        pharmacyId: "pharmacy-1",
        subtotal: 100,
        addressId: "address-alheio",
      })
    ).rejects.toThrow(/endereço de entrega inválido/i);
    expect(shippingForCents).not.toHaveBeenCalled();
  });
});
