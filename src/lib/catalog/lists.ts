import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SALEABLE_PRODUCT_WHERE } from "@/lib/catalog/policy";
import { productCardSelect, toProductCard } from "@/lib/catalog/cards";

// Categorias quase nunca mudam — cacheadas (tag "categories", revalida 1h).
// Evita uma query em praticamente toda navegação (home, catálogo, footer).
export const getCategories = unstable_cache(
  () => prisma.category.findMany({ orderBy: { sort: "asc" } }),
  ["categories"],
  { tags: ["categories"], revalidate: 3600 },
);

// Marcas alimentam o filtro do catálogo. Revalidação curta cobre marcas novas
// criadas pela importação CSV (que não invalida tags).
export const getBrands = unstable_cache(
  () => prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ["brands"],
  { tags: ["brands"], revalidate: 300 },
);

// Listas da home: cacheadas sob a tag "products" (uma entrada por unidade).
// As mutações de produto (admin) e a baixa de estoque (fulfillOrder) chamam
// revalidateTag("products").
export function getFeaturedProducts(take = 8, pharmacyId?: string | null) {
  return unstable_cache(
    async () =>
      (
        await prisma.product.findMany({
          where: { ...SALEABLE_PRODUCT_WHERE, featured: true },
          select: productCardSelect(pharmacyId),
          orderBy: { ratingCount: "desc" },
          take,
        })
      ).map(toProductCard),
    ["featured-products", String(take), pharmacyId ?? "all"],
    { tags: ["products"], revalidate: 300 },
  )();
}

export function getPromoProducts(take = 8, pharmacyId?: string | null) {
  return unstable_cache(
    async () =>
      (
        await prisma.product.findMany({
          where: {
            ...SALEABLE_PRODUCT_WHERE,
            ...(pharmacyId
              ? {
                  inventory: {
                    some: { pharmacyId, promoPrice: { not: null } },
                  },
                }
              : { promoPrice: { not: null } }),
          },
          select: productCardSelect(pharmacyId),
          orderBy: { ratingCount: "desc" },
          take,
        })
      ).map(toProductCard),
    ["promo-products", String(take), pharmacyId ?? "all"],
    { tags: ["products"], revalidate: 300 },
  )();
}

export function getProductsByCategory(
  slug: string,
  take = 8,
  pharmacyId?: string | null,
) {
  return unstable_cache(
    async () =>
      (
        await prisma.product.findMany({
          where: { ...SALEABLE_PRODUCT_WHERE, category: { slug } },
          select: productCardSelect(pharmacyId),
          orderBy: { ratingCount: "desc" },
          take,
        })
      ).map(toProductCard),
    ["products-by-category", slug, String(take), pharmacyId ?? "all"],
    { tags: ["products"], revalidate: 300 },
  )();
}

export async function getRelatedProducts(
  categoryId: string,
  excludeId: string,
  take = 4,
  pharmacyId?: string | null,
) {
  const rows = await prisma.product.findMany({
    where: {
      ...SALEABLE_PRODUCT_WHERE,
      categoryId,
      id: { not: excludeId },
    },
    select: productCardSelect(pharmacyId),
    orderBy: { ratingCount: "desc" },
    take,
  });
  return rows.map(toProductCard);
}
