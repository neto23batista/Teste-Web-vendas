import "server-only";

import { prisma } from "@/lib/prisma";
import { validateCoupon } from "@/lib/coupons";
import {
  maxRedeemablePointsForCents,
  pointsToCents,
} from "@/lib/loyalty";
import { shippingForCents, type DeliveryMethod } from "@/lib/shipping";
import { getShippingConfig, resolveKm } from "@/lib/settings";
import { centsToNumber, moneyToCents } from "@/lib/money";

export type CheckoutQuoteInput = {
  userId: string;
  pharmacyId: string;
  subtotal: number;
  addressId?: string | null;
  zip?: string | null;
  coupon?: string | null;
  requestedRedeemPoints?: number;
  deliveryMethod?: string | null;
};

export type CheckoutQuote = {
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number;
  couponUsageLimit: number | null;
  redeemPoints: number;
  redeemDiscount: number;
  loyaltyAccountId: string | null;
  discount: number;
  shipping: number;
  total: number;
  deliveryMethod: DeliveryMethod;
};

/** Fonte única dos valores exibidos e persistidos no checkout. */
export async function quoteCheckout(
  input: CheckoutQuoteInput
): Promise<CheckoutQuote> {
  const subtotalCents = moneyToCents(input.subtotal);
  if (subtotalCents === null) {
    throw new Error("Subtotal inválido.");
  }
  const requested = input.requestedRedeemPoints ?? 0;
  if (!Number.isSafeInteger(requested) || requested < 0) {
    throw new Error("Quantidade de pontos inválida.");
  }

  let zip = input.zip?.trim() || null;
  if (input.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: input.addressId, userId: input.userId },
      select: { zip: true },
    });
    if (!address) throw new Error("Endereço de entrega inválido.");
    zip = address.zip;
  }
  if (!zip) throw new Error("Informe o CEP para calcular o frete.");

  let couponCode: string | null = null;
  let couponDiscount = 0;
  let couponUsageLimit: number | null = null;
  const couponRaw = input.coupon?.trim().slice(0, 50) || "";
  if (couponRaw) {
    const coupon = await validateCoupon(couponRaw, subtotalCents, input.userId);
    if ("error" in coupon) throw new Error(coupon.error);
    couponCode = coupon.code;
    couponDiscount = coupon.discount;
    couponUsageLimit = coupon.usageLimit;
  }

  let redeemPoints = requested;
  let redeemDiscountCents = 0;
  let loyaltyAccountId: string | null = null;
  if (redeemPoints > 0) {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { userId: input.userId },
      select: { id: true, points: true },
    });
    redeemPoints = Math.min(
      redeemPoints,
      maxRedeemablePointsForCents(
        account?.points ?? 0,
        Math.max(0, subtotalCents - (moneyToCents(couponDiscount) ?? 0))
      )
    );
    if (redeemPoints > 0 && account) {
      loyaltyAccountId = account.id;
      redeemDiscountCents = pointsToCents(redeemPoints);
    } else {
      redeemPoints = 0;
    }
  }

  const deliveryMethod: DeliveryMethod =
    input.deliveryMethod === "express" ? "express" : "standard";
  const [shippingConfig, km] = await Promise.all([
    getShippingConfig(input.pharmacyId),
    resolveKm(zip, input.pharmacyId),
  ]);
  if (km === null) {
    throw new Error("Ainda não entregamos neste CEP. Escolha outro endereço.");
  }
  const couponDiscountCents = moneyToCents(couponDiscount) ?? 0;
  const shippingCents = shippingForCents(
    subtotalCents,
    km,
    deliveryMethod,
    shippingConfig
  );
  const discountCents = couponDiscountCents + redeemDiscountCents;
  const totalCents = Math.max(0, subtotalCents - discountCents) + shippingCents;

  return {
    subtotal: centsToNumber(subtotalCents),
    couponCode,
    couponDiscount: centsToNumber(couponDiscountCents),
    couponUsageLimit,
    redeemPoints,
    redeemDiscount: centsToNumber(redeemDiscountCents),
    loyaltyAccountId,
    discount: centsToNumber(discountCents),
    shipping: centsToNumber(shippingCents),
    total: centsToNumber(totalCents),
    deliveryMethod,
  };
}
