import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** Campos mínimos que o card de produto precisa. */
export const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  emoji: true,
  price: true,
  promoPrice: true,
  requiresPrescription: true,
  isGeneric: true,
  stock: true,
  rating: true,
  ratingCount: true,
  category: { select: { name: true, slug: true } },
  brand: { select: { name: true } },
  images: { select: { url: true }, orderBy: { sort: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{
  select: typeof productCardSelect;
}>;

// Categorias quase nunca mudam — cacheadas (tag "categories", revalida 1h).
// Evita uma query em praticamente toda navegação (home, catálogo, footer).
export const getCategories = unstable_cache(
  () => prisma.category.findMany({ orderBy: { sort: "asc" } }),
  ["categories"],
  { tags: ["categories"], revalidate: 3600 }
);

// Marcas alimentam o filtro do catálogo. Revalidação curta cobre marcas novas
// criadas pela importação CSV (que não invalida tags).
export const getBrands = unstable_cache(
  () => prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ["brands"],
  { tags: ["brands"], revalidate: 300 }
);

// Listas da home: cacheadas sob a tag "products". As mutações de produto
// (admin) e a baixa de estoque (fulfillOrder) chamam revalidateTag("products").
export function getFeaturedProducts(take = 8) {
  return unstable_cache(
    () =>
      prisma.product.findMany({
        where: { active: true, featured: true },
        select: productCardSelect,
        orderBy: { ratingCount: "desc" },
        take,
      }),
    ["featured-products", String(take)],
    { tags: ["products"], revalidate: 300 }
  )();
}

export function getPromoProducts(take = 8) {
  return unstable_cache(
    () =>
      prisma.product.findMany({
        where: { active: true, promoPrice: { not: null } },
        select: productCardSelect,
        orderBy: { ratingCount: "desc" },
        take,
      }),
    ["promo-products", String(take)],
    { tags: ["products"], revalidate: 300 }
  )();
}

export function getProductsByCategory(slug: string, take = 8) {
  return unstable_cache(
    () =>
      prisma.product.findMany({
        where: { active: true, category: { slug } },
        select: productCardSelect,
        orderBy: { ratingCount: "desc" },
        take,
      }),
    ["products-by-category", slug, String(take)],
    { tags: ["products"], revalidate: 300 }
  )();
}

export type CatalogParams = {
  q?: string;
  cat?: string;
  brand?: string;
  generic?: boolean;
  rx?: boolean;
  promo?: boolean;
  priceMin?: number;
  priceMax?: number;
  sort?: "relevancia" | "menor" | "maior" | "nome";
  page?: number;
  perPage?: number;
};

type SearchResult = {
  items: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

export async function searchProducts(params: CatalogParams): Promise<SearchResult> {
  const perPage = params.perPage ?? 12;
  const page = Math.max(1, params.page ?? 1);

  const where: Prisma.ProductWhereInput = { active: true };
  if (params.q) {
    // Busca multi-termo: cada palavra precisa aparecer em ALGUM campo
    // (nome, descrição, princípio ativo, SKU, EAN ou marca). Mais preciso que
    // um único `contains` para consultas como "dipirona 500".
    const terms = params.q
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (terms.length > 0) {
      // `mode: "insensitive"` porque no Postgres o LIKE é case-sensitive.
      where.AND = terms.map((t): Prisma.ProductWhereInput => ({
        OR: [
          { name: { contains: t, mode: "insensitive" } },
          { description: { contains: t, mode: "insensitive" } },
          { activeIngredient: { contains: t, mode: "insensitive" } },
          { sku: { contains: t, mode: "insensitive" } },
          { ean: { contains: t, mode: "insensitive" } },
          { brand: { name: { contains: t, mode: "insensitive" } } },
        ],
      }));
    }
  }
  if (params.cat) where.category = { slug: params.cat };
  if (params.brand) where.brand = { slug: params.brand };
  if (params.generic) where.isGeneric = true;
  if (params.rx === false) where.requiresPrescription = false;
  if (params.promo) where.promoPrice = { not: null };
  // Faixa de preço sobre o valor efetivo (promoPrice quando houver, senão price).
  const priceConds: Prisma.ProductWhereInput[] = [];
  if (params.priceMin != null) {
    priceConds.push({
      OR: [
        { promoPrice: { gte: params.priceMin } },
        { promoPrice: null, price: { gte: params.priceMin } },
      ],
    });
  }
  if (params.priceMax != null) {
    priceConds.push({
      OR: [
        { promoPrice: { lte: params.priceMax } },
        { promoPrice: null, price: { lte: params.priceMax } },
      ],
    });
  }
  if (priceConds.length > 0) {
    where.AND = [...((where.AND as Prisma.ProductWhereInput[]) ?? []), ...priceConds];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    params.sort === "menor"
      ? { price: "asc" }
      : params.sort === "maior"
        ? { price: "desc" }
        : params.sort === "nome"
          ? { name: "asc" }
          : { ratingCount: "desc" };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productCardSelect,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
}

export function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      brand: true,
      images: { orderBy: { sort: "asc" } },
      reviews: {
        where: { approved: true },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { user: { select: { name: true } } },
      },
    },
  });
}

export function getRelatedProducts(categoryId: string, excludeId: string, take = 4) {
  return prisma.product.findMany({
    where: { active: true, categoryId, id: { not: excludeId } },
    select: productCardSelect,
    orderBy: { ratingCount: "desc" },
    take,
  });
}
