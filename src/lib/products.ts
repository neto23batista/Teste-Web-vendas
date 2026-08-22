import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SALEABLE_PRODUCT_WHERE } from "@/lib/product-policy";
import { moneyToNumber } from "@/lib/money";

/** Campos do card, exceto o estoque (que agora é por unidade — ver Inventory). */
const productCardBase = {
  id: true,
  name: true,
  slug: true,
  emoji: true,
  price: true,
  promoPrice: true,
  isGeneric: true,
  rating: true,
  ratingCount: true,
  category: { select: { name: true, slug: true } },
  brand: { select: { name: true } },
  images: { select: { url: true }, orderBy: { sort: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

/**
 * Select do card de produto com o estoque da unidade informada. Sem unidade
 * (null), traz o estoque de todas e o mapper soma (visão agregada).
 */
export function productCardSelect(pharmacyId?: string | null) {
  return {
    ...productCardBase,
    inventory: {
      where: pharmacyId ? { pharmacyId } : undefined,
      select: { stock: true },
    },
  } satisfies Prisma.ProductSelect;
}

type ProductCardRow = Prisma.ProductGetPayload<{
  select: ReturnType<typeof productCardSelect>;
}>;

/** Card com o estoque já achatado em `stock` (da unidade selecionada). */
export type ProductCard = Omit<
  ProductCardRow,
  "inventory" | "price" | "promoPrice"
> & {
  price: number;
  promoPrice: number | null;
  stock: number;
};

export function toProductCard(row: ProductCardRow): ProductCard {
  const { inventory, ...rest } = row;
  const stock = inventory.reduce((sum, i) => sum + i.stock, 0);
  return {
    ...rest,
    price: moneyToNumber(rest.price),
    promoPrice: rest.promoPrice == null ? null : moneyToNumber(rest.promoPrice),
    stock,
  };
}

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
    { tags: ["products"], revalidate: 300 }
  )();
}

export function getPromoProducts(take = 8, pharmacyId?: string | null) {
  return unstable_cache(
    async () =>
      (
        await prisma.product.findMany({
          where: { ...SALEABLE_PRODUCT_WHERE, promoPrice: { not: null } },
          select: productCardSelect(pharmacyId),
          orderBy: { ratingCount: "desc" },
          take,
        })
      ).map(toProductCard),
    ["promo-products", String(take), pharmacyId ?? "all"],
    { tags: ["products"], revalidate: 300 }
  )();
}

export function getProductsByCategory(
  slug: string,
  take = 8,
  pharmacyId?: string | null
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
    { tags: ["products"], revalidate: 300 }
  )();
}

export type CatalogParams = {
  q?: string;
  cat?: string;
  brand?: string;
  generic?: boolean;
  promo?: boolean;
  priceMin?: number;
  priceMax?: number;
  sort?: "relevancia" | "menor" | "maior" | "nome";
  page?: number;
  perPage?: number;
  /** Unidade selecionada — define o estoque exibido. */
  pharmacyId?: string | null;
};

type SearchResult = {
  items: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

const MAX_SEARCH_TERMS = 6;

function normalizedSearchTerms(query?: string): string[] {
  return (query ?? "")
    .split(/\s+/)
    .map((term) => term.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);
}

/** Mantém filtros do catálogo e autocomplete consistentes. */
function catalogWhere(params: CatalogParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ...SALEABLE_PRODUCT_WHERE };
  const and: Prisma.ProductWhereInput[] = [];
  const terms = normalizedSearchTerms(params.q);

  if (terms.length > 0) {
    // Cada palavra precisa aparecer em algum campo pesquisável.
    and.push(
      ...terms.map((term): Prisma.ProductWhereInput => ({
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { activeIngredient: { contains: term, mode: "insensitive" } },
          { sku: { contains: term, mode: "insensitive" } },
          { ean: { contains: term, mode: "insensitive" } },
          { brand: { name: { contains: term, mode: "insensitive" } } },
        ],
      }))
    );
  }
  if (params.cat) where.category = { slug: params.cat };
  if (params.brand) where.brand = { slug: params.brand };
  if (params.generic) where.isGeneric = true;
  if (params.promo) where.promoPrice = { not: null };

  // Faixa de preço sobre o valor efetivo (promoPrice quando houver, senão price).
  if (params.priceMin != null) {
    and.push({
      OR: [
        { promoPrice: { gte: params.priceMin } },
        { promoPrice: null, price: { gte: params.priceMin } },
      ],
    });
  }
  if (params.priceMax != null) {
    and.push({
      OR: [
        { promoPrice: { lte: params.priceMax } },
        { promoPrice: null, price: { lte: params.priceMax } },
      ],
    });
  }
  if (and.length > 0) where.AND = and;
  return where;
}

export type ProductSuggestion = {
  name: string;
  slug: string;
  emoji: string | null;
  image: string | null;
  price: number;
  oldPrice: number | null;
  category: string;
};

/**
 * Consulta dedicada ao autocomplete. Diferente de `searchProducts`, não faz
 * COUNT, não carrega estoque/reviews e não busca uma janela de 200 registros.
 */
export async function getProductSuggestions(
  query: string,
  take = 6
): Promise<ProductSuggestion[]> {
  if (query.trim().length < 2) return [];
  const requestedTake = Math.trunc(Number(take));
  const safeTake = Number.isFinite(requestedTake)
    ? Math.min(12, Math.max(1, requestedTake))
    : 6;
  const normalizedQuery = query.trim();
  const filters: Prisma.Sql[] = [
    Prisma.sql`p."active" = TRUE`,
    Prisma.sql`p."requiresPrescription" = FALSE`,
  ];
  for (const term of normalizedSearchTerms(normalizedQuery)) {
    const pattern = `%${term}%`;
    filters.push(Prisma.sql`(
      p."name" ILIKE ${pattern}
      OR p."description" ILIKE ${pattern}
      OR p."activeIngredient" ILIKE ${pattern}
      OR p."sku" ILIKE ${pattern}
      OR p."ean" ILIKE ${pattern}
      OR b."name" ILIKE ${pattern}
    )`);
  }

  const exact = normalizedQuery.toLowerCase();
  const prefix = `${normalizedQuery}%`;
  const contains = `%${normalizedQuery}%`;
  const rows = await prisma.$queryRaw<
    (Omit<ProductSuggestion, "price" | "oldPrice"> & {
      price: Prisma.Decimal;
      oldPrice: Prisma.Decimal | null;
    })[]
  >(Prisma.sql`
    SELECT
      p."name",
      p."slug",
      p."emoji",
      image."url" AS "image",
      COALESCE(p."promoPrice", p."price") AS "price",
      CASE WHEN p."promoPrice" IS NOT NULL THEN p."price" ELSE NULL END AS "oldPrice",
      c."name" AS "category"
    FROM "Product" AS p
    INNER JOIN "Category" AS c ON c."id" = p."categoryId"
    LEFT JOIN "Brand" AS b ON b."id" = p."brandId"
    LEFT JOIN LATERAL (
      SELECT pi."url"
      FROM "ProductImage" AS pi
      WHERE pi."productId" = p."id"
      ORDER BY pi."sort" ASC, pi."id" ASC
      LIMIT 1
    ) AS image ON TRUE
    WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY
      CASE
        WHEN LOWER(p."name") = ${exact} THEN 0
        WHEN p."name" ILIKE ${prefix} THEN 1
        WHEN p."name" ILIKE ${contains} THEN 2
        ELSE 3
      END,
      p."ratingCount" DESC,
      p."name" ASC
    LIMIT ${safeTake}
  `);
  return rows.map((row) => ({
    ...row,
    price: moneyToNumber(row.price),
    oldPrice: row.oldPrice == null ? null : moneyToNumber(row.oldPrice),
  }));
}

// Tamanho da janela de ranking por relevância: os N melhores resultados (por
// avaliação) são re-ranqueados por nome no app. Buscas com mais matches que
// isso caem na paginação direta do banco nas páginas além da janela.
const RELEVANCE_WINDOW = 200;

export async function searchProducts(params: CatalogParams): Promise<SearchResult> {
  const requestedPerPage = Math.trunc(Number(params.perPage ?? 12));
  const perPage = Number.isFinite(requestedPerPage)
    ? Math.min(100, Math.max(1, requestedPerPage))
    : 12;
  const requestedPage = Math.trunc(Number(params.page ?? 1));
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const where = catalogWhere(params);

  // Modo de ordenação num único discriminante (usado no orderBy e na relevância).
  const sortMode =
    params.sort === "menor" || params.sort === "maior" || params.sort === "nome"
      ? params.sort
      : "relevancia";
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sortMode === "nome"
      ? { name: "asc" }
      : { ratingCount: "desc" };

  // O Prisma não expressa ORDER BY COALESCE em `orderBy`. Uma consulta
  // parametrizada busca somente os IDs e o total da página; os cards continuam
  // usando o select tipado. Assim promoções são ordenadas pelo preço realmente
  // cobrado, e não pelo preço de tabela.
  if (sortMode === "menor" || sortMode === "maior") {
    const filters: Prisma.Sql[] = [
      Prisma.sql`p."active" = TRUE`,
      Prisma.sql`p."requiresPrescription" = FALSE`,
    ];
    for (const term of normalizedSearchTerms(params.q)) {
      const pattern = `%${term}%`;
      filters.push(Prisma.sql`(
        p."name" ILIKE ${pattern}
        OR p."description" ILIKE ${pattern}
        OR p."activeIngredient" ILIKE ${pattern}
        OR p."sku" ILIKE ${pattern}
        OR p."ean" ILIKE ${pattern}
        OR b."name" ILIKE ${pattern}
      )`);
    }
    if (params.cat) filters.push(Prisma.sql`c."slug" = ${params.cat}`);
    if (params.brand) filters.push(Prisma.sql`b."slug" = ${params.brand}`);
    if (params.generic) filters.push(Prisma.sql`p."isGeneric" = TRUE`);
    if (params.promo) filters.push(Prisma.sql`p."promoPrice" IS NOT NULL`);
    if (params.priceMin != null) {
      filters.push(
        Prisma.sql`COALESCE(p."promoPrice", p."price") >= ${params.priceMin}`
      );
    }
    if (params.priceMax != null) {
      filters.push(
        Prisma.sql`COALESCE(p."promoPrice", p."price") <= ${params.priceMax}`
      );
    }

    const direction =
      sortMode === "menor" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const idRows = await prisma.$queryRaw<
      { id: string; total: number | bigint }[]
    >(Prisma.sql`
      SELECT p."id", COUNT(*) OVER()::integer AS "total"
      FROM "Product" AS p
      INNER JOIN "Category" AS c ON c."id" = p."categoryId"
      LEFT JOIN "Brand" AS b ON b."id" = p."brandId"
      WHERE ${Prisma.join(filters, " AND ")}
      ORDER BY COALESCE(p."promoPrice", p."price") ${direction},
               p."name" ASC,
               p."id" ASC
      LIMIT ${perPage}
      OFFSET ${(page - 1) * perPage}
    `);
    const ids = idRows.map((row) => row.id);
    const total =
      idRows.length > 0 ? Number(idRows[0].total) : await prisma.product.count({ where });
    const rows = ids.length
      ? await prisma.product.findMany({
          where: { id: { in: ids }, ...SALEABLE_PRODUCT_WHERE },
          select: productCardSelect(params.pharmacyId),
        })
      : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null)
      .map(toProductCard);
    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }

  // Relevância: ranqueia por correspondência de NOME (igual > prefixo > contém)
  // sobre uma JANELA dos melhores resultados — antes da paginação — para que um
  // match exato com poucas avaliações chegue à 1ª página. A janela
  // é buscada só com id+nome (leve); os cards da página vêm por id em seguida.
  const useRelevance =
    !!params.q &&
    sortMode === "relevancia" &&
    (page - 1) * perPage + perPage <= RELEVANCE_WINDOW;
  if (useRelevance) {
    const [win, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: { id: true, name: true },
        orderBy,
        take: RELEVANCE_WINDOW,
      }),
      prisma.product.count({ where }),
    ]);

    const q = params.q!.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const score = (name: string): number => {
      const n = name.toLowerCase();
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      if (n.includes(q)) return 2;
      if (terms.every((t) => n.includes(t))) return 3;
      return 4;
    };
    // sort é estável (ES2019): empate mantém a ordem por avaliação do banco.
    win.sort((a, b) => score(a.name) - score(b.name));

    const start = (page - 1) * perPage;
    const pageIds = win.slice(start, start + perPage).map((w) => w.id);
    const rows = pageIds.length
      ? await prisma.product.findMany({
          where: { id: { in: pageIds }, ...SALEABLE_PRODUCT_WHERE },
          select: productCardSelect(params.pharmacyId),
        })
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = pageIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map(toProductCard);

    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  }

  // Demais ordenações (ou páginas além da janela): paginação direta no banco.
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productCardSelect(params.pharmacyId),
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map(toProductCard),
    total,
    page,
    perPage,
    pages: Math.ceil(total / perPage),
  };
}

export async function getProductBySlug(slug: string, pharmacyId?: string | null) {
  const product = await prisma.product.findFirst({
    where: { slug, ...SALEABLE_PRODUCT_WHERE },
    include: {
      category: true,
      brand: true,
      images: { orderBy: { sort: "asc" } },
      inventory: {
        where: pharmacyId ? { pharmacyId } : undefined,
        select: { stock: true },
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
  return {
    ...rest,
    price: moneyToNumber(rest.price),
    costPrice: rest.costPrice == null ? null : moneyToNumber(rest.costPrice),
    promoPrice: rest.promoPrice == null ? null : moneyToNumber(rest.promoPrice),
    stock,
  };
}

/** Select mínimo para SEO; evita carregar imagens, reviews e estoque duas vezes. */
export function getProductMetadataBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, ...SALEABLE_PRODUCT_WHERE },
    select: { name: true, shortDescription: true },
  });
}

export async function getRelatedProducts(
  categoryId: string,
  excludeId: string,
  take = 4,
  pharmacyId?: string | null
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
