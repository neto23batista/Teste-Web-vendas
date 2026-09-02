import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SALEABLE_PRODUCT_WHERE } from "@/lib/catalog/policy";
import { moneyToNumber } from "@/lib/money";
import {
  type ProductCard,
  productCardSelect,
  toProductCard,
} from "@/lib/catalog/cards";
import {
  normalizedSearchTerms,
  type CatalogParams,
  catalogWhere,
} from "@/lib/catalog/filters";

type SearchResult = {
  items: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
};

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
  take = 6,
  pharmacyId?: string | null,
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
      OR unit_inventory."sku" ILIKE ${pattern}
      OR unit_inventory."ean" ILIKE ${pattern}
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
      COALESCE(
        unit_inventory."promoPrice",
        unit_inventory."price",
        p."promoPrice",
        p."price"
      ) AS "price",
      CASE
        WHEN COALESCE(unit_inventory."promoPrice", p."promoPrice") IS NOT NULL
        THEN COALESCE(unit_inventory."price", p."price")
        ELSE NULL
      END AS "oldPrice",
      c."name" AS "category"
    FROM "Product" AS p
    INNER JOIN "Category" AS c ON c."id" = p."categoryId"
    LEFT JOIN "Brand" AS b ON b."id" = p."brandId"
    LEFT JOIN "Inventory" AS unit_inventory
      ON unit_inventory."productId" = p."id"
     AND unit_inventory."pharmacyId" = ${pharmacyId ?? null}
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

export async function searchProducts(
  params: CatalogParams,
): Promise<SearchResult> {
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
    sortMode === "nome" ? { name: "asc" } : { ratingCount: "desc" };

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
        OR unit_inventory."sku" ILIKE ${pattern}
        OR unit_inventory."ean" ILIKE ${pattern}
        OR b."name" ILIKE ${pattern}
      )`);
    }
    if (params.cat) filters.push(Prisma.sql`c."slug" = ${params.cat}`);
    if (params.brand) filters.push(Prisma.sql`b."slug" = ${params.brand}`);
    if (params.generic) filters.push(Prisma.sql`p."isGeneric" = TRUE`);
    if (params.promo) {
      filters.push(
        Prisma.sql`COALESCE(unit_inventory."promoPrice", p."promoPrice") IS NOT NULL`,
      );
    }
    if (params.priceMin != null) {
      filters.push(
        Prisma.sql`COALESCE(unit_inventory."promoPrice", unit_inventory."price", p."promoPrice", p."price") >= ${params.priceMin}`,
      );
    }
    if (params.priceMax != null) {
      filters.push(
        Prisma.sql`COALESCE(unit_inventory."promoPrice", unit_inventory."price", p."promoPrice", p."price") <= ${params.priceMax}`,
      );
    }

    const direction = sortMode === "menor" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const idRows = await prisma.$queryRaw<
      { id: string; total: number | bigint }[]
    >(Prisma.sql`
      SELECT p."id", COUNT(*) OVER()::integer AS "total"
      FROM "Product" AS p
      INNER JOIN "Category" AS c ON c."id" = p."categoryId"
      LEFT JOIN "Brand" AS b ON b."id" = p."brandId"
      LEFT JOIN "Inventory" AS unit_inventory
        ON unit_inventory."productId" = p."id"
       AND unit_inventory."pharmacyId" = ${params.pharmacyId ?? null}
      WHERE ${Prisma.join(filters, " AND ")}
      ORDER BY COALESCE(
                 unit_inventory."promoPrice",
                 unit_inventory."price",
                 p."promoPrice",
                 p."price"
               ) ${direction},
               p."name" ASC,
               p."id" ASC
      LIMIT ${perPage}
      OFFSET ${(page - 1) * perPage}
    `);
    const ids = idRows.map((row) => row.id);
    const total =
      idRows.length > 0
        ? Number(idRows[0].total)
        : await prisma.product.count({ where });
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
