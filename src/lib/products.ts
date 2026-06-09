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
  generic?: boolean;
  rx?: boolean;
  promo?: boolean;
  sort?: "relevancia" | "menor" | "maior" | "nome";
  page?: number;
  perPage?: number;
};

// Monta a string de busca boolean do MySQL: cada termo vira "+termo*" (todos
// obrigatórios, com prefixo). Termos abaixo do mínimo do índice (3) são
// descartados; se nada sobrar, retorna null → cai no LIKE multi-termo.
function booleanQuery(q: string): string | null {
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/[+\-><()~*"@]/g, "").trim())
    .filter((t) => t.length >= 3)
    .slice(0, 6);
  if (terms.length === 0) return null;
  return terms.map((t) => `+${t}*`).join(" ");
}

const ftMatch = (bool: string) =>
  Prisma.sql`MATCH(p.name, p.shortDescription, p.description, p.activeIngredient) AGAINST (${bool} IN BOOLEAN MODE)`;

type SearchResult = {
  items: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

/**
 * Busca por relevância via índice FULLTEXT (MySQL, BOOLEAN MODE). Retorna null
 * quando os termos são curtos demais ou não há nenhum match — aí o chamador
 * usa o LIKE multi-termo (substring), que cobre esses casos.
 */
async function fulltextSearch(
  params: CatalogParams,
  perPage: number,
  page: number
): Promise<SearchResult | null> {
  const bool = booleanQuery(params.q ?? "");
  if (!bool) return null;

  const conds: Prisma.Sql[] = [Prisma.sql`p.active = 1`, ftMatch(bool)];
  if (params.cat) conds.push(Prisma.sql`c.slug = ${params.cat}`);
  if (params.generic) conds.push(Prisma.sql`p.isGeneric = 1`);
  if (params.rx === false) conds.push(Prisma.sql`p.requiresPrescription = 0`);
  if (params.promo) conds.push(Prisma.sql`p.promoPrice IS NOT NULL`);
  const whereSql = Prisma.join(conds, " AND ");

  const countRows = await prisma.$queryRaw<{ cnt: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS cnt FROM Product p
    JOIN Category c ON c.id = p.categoryId
    WHERE ${whereSql}
  `);
  const total = Number(countRows[0]?.cnt ?? 0);
  if (total === 0) return null;

  const offset = (page - 1) * perPage;
  const idRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT p.id FROM Product p
    JOIN Category c ON c.id = p.categoryId
    WHERE ${whereSql}
    ORDER BY ${ftMatch(bool)} DESC, p.ratingCount DESC
    LIMIT ${perPage} OFFSET ${offset}
  `);
  const ids = idRows.map((r) => r.id);

  const found = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: productCardSelect,
  });
  const byId = new Map(found.map((p) => [p.id, p]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((p): p is ProductCard => Boolean(p));

  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function searchProducts(params: CatalogParams): Promise<SearchResult> {
  const perPage = params.perPage ?? 12;
  const page = Math.max(1, params.page ?? 1);

  // Relevância via FULLTEXT só faz sentido na ordenação padrão. Nas demais
  // (preço/nome) seguimos no LIKE com a ordenação escolhida.
  if (params.q && (!params.sort || params.sort === "relevancia")) {
    const ft = await fulltextSearch(params, perPage, page).catch(() => null);
    if (ft) return ft;
  }

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
      where.AND = terms.map((t) => ({
        OR: [
          { name: { contains: t } },
          { description: { contains: t } },
          { activeIngredient: { contains: t } },
          { sku: { contains: t } },
          { ean: { contains: t } },
          { brand: { name: { contains: t } } },
        ],
      }));
    }
  }
  if (params.cat) where.category = { slug: params.cat };
  if (params.generic) where.isGeneric = true;
  if (params.rx === false) where.requiresPrescription = false;
  if (params.promo) where.promoPrice = { not: null };

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
