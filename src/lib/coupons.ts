import { prisma } from "@/lib/prisma";

export type CouponResult =
  | { code: string; discount: number; usageLimit: number | null }
  | { error: string };

export async function validateCoupon(
  rawCode: string,
  subtotal: number
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { error: "Informe um cupom." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { error: "Cupom inválido." };
  if (coupon.expiresAt && coupon.expiresAt < new Date())
    return { error: "Cupom expirado." };
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return { error: "Cupom esgotado." };
  if (subtotal < coupon.minTotal)
    return {
      error: `Válido para compras acima de ${coupon.minTotal.toLocaleString(
        "pt-BR",
        { style: "currency", currency: "BRL" }
      )}.`,
    };

  const discount =
    coupon.type === "PERCENT"
      ? (subtotal * coupon.value) / 100
      : Math.min(coupon.value, subtotal);

  return {
    code,
    discount: Math.round(discount * 100) / 100,
    usageLimit: coupon.usageLimit,
  };
}
