import "server-only";

import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/auth/session";
import { getCategoriesAndBrands } from "@/lib/admin";
import { moneyToNumber } from "@/lib/money";

export async function getAdminProductEditorView(id: string) {
  await requireArea("produtos");
  const [product, matrixInventory, options] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        name: true, emoji: true, sku: true, ean: true, price: true,
        promoPrice: true, costPrice: true, categoryId: true, brandId: true,
        shortDescription: true, activeIngredient: true, description: true,
        isGeneric: true, featured: true, active: true, requiresPrescription: true,
        images: { orderBy: { sort: "asc" }, select: { url: true } },
      },
    }),
    prisma.inventory.findFirst({
      where: { productId: id, pharmacy: { type: "MATRIZ" } },
      select: { stock: true, minStock: true },
    }),
    getCategoriesAndBrands(),
  ]);
  if (!product) return null;
  const [categories, brands] = options;
  return {
    product: {
      ...product,
      price: moneyToNumber(product.price),
      promoPrice: product.promoPrice == null ? null : moneyToNumber(product.promoPrice),
      costPrice: product.costPrice == null ? null : moneyToNumber(product.costPrice),
      stock: matrixInventory?.stock ?? 0,
      minStock: matrixInventory?.minStock ?? 5,
    },
    categories: categories.map(({ id, name }) => ({ id, name })),
    brands: brands.map(({ id, name }) => ({ id, name })),
  };
}

const couponSelect = {
  id: true, code: true, type: true, value: true, minTotal: true,
  usageLimit: true, usageLimitPerCustomer: true, usedCount: true,
  expiresAt: true, active: true,
} as const;

export async function getAdminCouponsView() {
  await requireArea("cupons");
  const coupons = await prisma.coupon.findMany({
    orderBy: { active: "desc" }, select: couponSelect,
  });
  const now = Date.now();
  return coupons.map((coupon) => ({
    ...coupon,
    value: moneyToNumber(coupon.value),
    minTotal: moneyToNumber(coupon.minTotal),
    expired: Boolean(coupon.expiresAt && coupon.expiresAt.getTime() < now),
  }));
}

export async function getAdminCouponEditorView(id: string) {
  await requireArea("cupons");
  const coupon = await prisma.coupon.findUnique({ where: { id }, select: couponSelect });
  if (!coupon) return null;
  return {
    ...coupon,
    value: moneyToNumber(coupon.value),
    minTotal: moneyToNumber(coupon.minTotal),
  };
}
