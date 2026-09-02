import { prisma } from "@/lib/prisma";
import { SALEABLE_PRODUCT_WHERE } from "@/lib/catalog/policy";
import { moneyToNumber } from "@/lib/money";

export async function getProductBySlug(
  slug: string,
  pharmacyId?: string | null,
) {
  const product = await prisma.product.findFirst({
    where: { slug, ...SALEABLE_PRODUCT_WHERE },
    include: {
      category: true,
      brand: true,
      images: { orderBy: { sort: "asc" } },
      inventory: {
        where: pharmacyId ? { pharmacyId } : undefined,
        select: {
          stock: true,
          price: true,
          costPrice: true,
          promoPrice: true,
          sku: true,
          ean: true,
        },
      },
      reviews: {
        where: { approved: true },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!product) return null;
  const { inventory, ...rest } = product;
  const stock = inventory.reduce((sum, i) => sum + i.stock, 0);
  const unitOffer = inventory.length === 1 ? inventory[0] : null;
  const effectivePrice = unitOffer?.price ?? rest.price;
  const effectiveCost = unitOffer?.costPrice ?? rest.costPrice;
  const effectivePromo = unitOffer?.promoPrice ?? rest.promoPrice;
  return {
    ...rest,
    sku: unitOffer?.sku ?? rest.sku,
    ean: unitOffer?.ean ?? rest.ean,
    price: moneyToNumber(effectivePrice),
    costPrice: effectiveCost == null ? null : moneyToNumber(effectiveCost),
    promoPrice: effectivePromo == null ? null : moneyToNumber(effectivePromo),
    stock,
  };
}

/** Select mínimo para SEO; evita carregar imagens, reviews e estoque duas vezes. */
export function getProductMetadataBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, ...SALEABLE_PRODUCT_WHERE },
    select: {
      name: true,
      shortDescription: true,
      description: true,
      images: { orderBy: { sort: "asc" }, take: 1, select: { url: true } },
    },
  });
}
