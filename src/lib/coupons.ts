import { prisma } from "@/lib/prisma";
import { centsToNumber, moneyToCents, percentageOfCents } from "@/lib/money";

export type CouponResult =
  | { code: string; discount: number; usageLimit: number | null }
  | { error: string };

export async function validateCoupon(
  rawCode: string,
  subtotalCents: number
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { error: "Informe um cupom." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { error: "Cupom inválido." };
  if (coupon.expiresAt && coupon.expiresAt < new Date())
    return { error: "Cupom expirado." };
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return { error: "Cupom esgotado." };
  const minTotalCents = moneyToCents(coupon.minTotal);
  const valueCents = moneyToCents(coupon.value);
  if (minTotalCents === null || valueCents === null) {
    return { error: "Cupom com valor inválido." };
  }
  if (subtotalCents < minTotalCents)
    return {
      error: `Válido para compras acima de ${centsToNumber(minTotalCents).toLocaleString(
        "pt-BR",
        { style: "currency", currency: "BRL" }
      )}.`,
    };

  const discountCents =
    coupon.type === "PERCENT"
      ? percentageOfCents(subtotalCents, coupon.value)
      : Math.min(valueCents, subtotalCents);
  if (discountCents === null) return { error: "Cupom com valor inválido." };

  return {
    code,
    discount: centsToNumber(discountCents),
    usageLimit: coupon.usageLimit,
  };
}
