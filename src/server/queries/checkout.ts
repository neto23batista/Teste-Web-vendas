import "server-only";

import { requireUserPage } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCart } from "@/lib/commerce/cart";
import { getPaymentSettings, getShippingConfig, resolveKm } from "@/lib/settings";
import { defaultPaymentMethod, paymentAvailability } from "@/lib/payments/methods";
import { deliveryOptions } from "@/lib/shipping/rates";
import { maxRedeemablePoints, pointsToBRL } from "@/lib/commerce/loyalty";
import { isValidCpf } from "@/lib/cpf";

/** Dados privados do checkout; credenciais do provedor nunca saem desta camada. */
export async function getCheckoutView() {
  const user = await requireUserPage("/checkout");
  const cart = await getCart();
  if (!cart?.items.length) return null;

  const [savedAddresses, loyalty, shippingConfig, profile, payment] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: { isDefault: "desc" },
      select: {
        id: true, label: true, recipient: true, zip: true, street: true,
        number: true, complement: true, district: true, city: true,
        state: true, isDefault: true,
      },
    }),
    prisma.loyaltyAccount.findUnique({ where: { userId: user.id }, select: { points: true } }),
    getShippingConfig(cart.pharmacyId),
    prisma.user.findUnique({ where: { id: user.id }, select: { cpf: true } }),
    getPaymentSettings(),
  ]);
  const addresses = await Promise.all(savedAddresses.map(async (address) => {
    const km = await resolveKm(address.zip, cart.pharmacyId);
    return { ...address, km: km ?? shippingConfig.defaultKm, covered: km !== null };
  }));
  const availability = paymentAvailability(payment);
  const points = loyalty?.points ?? 0;
  const maxRedeem = maxRedeemablePoints(points, cart.subtotal);
  return {
    addresses,
    subtotal: cart.subtotal,
    points,
    initialDeliveryOptions: deliveryOptions(cart.subtotal, shippingConfig.defaultKm, shippingConfig),
    deliveryOptionsByAddress: Object.fromEntries(addresses.map((address) => [
      address.id, deliveryOptions(cart.subtotal, address.km, shippingConfig),
    ])),
    maxRedeem,
    maxRedeemDiscount: pointsToBRL(maxRedeem),
    initialPaymentMethod: defaultPaymentMethod(availability),
    hasCpf: isValidCpf(profile?.cpf ?? ""),
    availability,
  };
}
