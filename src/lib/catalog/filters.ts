import { Prisma } from "@prisma/client";
import { SALEABLE_PRODUCT_WHERE } from "@/lib/catalog/policy";

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

const MAX_SEARCH_TERMS = 6;

export function normalizedSearchTerms(query?: string): string[] {
  return (query ?? "")
    .split(/\s+/)
    .map((term) => term.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);
}

/** Mantém filtros do catálogo e autocomplete consistentes. */
export function catalogWhere(params: CatalogParams): Prisma.ProductWhereInput {
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
          ...(params.pharmacyId
            ? [
                {
                  inventory: {
                    some: {
                      pharmacyId: params.pharmacyId,
                      OR: [
                        {
                          sku: { contains: term, mode: "insensitive" as const },
                        },
                        {
                          ean: { contains: term, mode: "insensitive" as const },
                        },
                      ],
                    },
                  },
                },
              ]
            : []),
          { brand: { name: { contains: term, mode: "insensitive" } } },
        ],
      })),
    );
  }
  if (params.cat) where.category = { slug: params.cat };
  if (params.brand) where.brand = { slug: params.brand };
  if (params.generic) where.isGeneric = true;
  if (params.promo) {
    if (params.pharmacyId) {
      and.push({
        inventory: {
          some: { pharmacyId: params.pharmacyId, promoPrice: { not: null } },
        },
      });
    } else {
      where.promoPrice = { not: null };
    }
  }

  // Faixa de preço sobre o valor efetivo (promoPrice quando houver, senão price).
  if (params.priceMin != null) {
    and.push(
      params.pharmacyId
        ? {
            inventory: {
              some: {
                pharmacyId: params.pharmacyId,
                OR: [
                  { promoPrice: { gte: params.priceMin } },
                  { promoPrice: null, price: { gte: params.priceMin } },
                ],
              },
            },
          }
        : {
            OR: [
              { promoPrice: { gte: params.priceMin } },
              { promoPrice: null, price: { gte: params.priceMin } },
            ],
          },
    );
  }
  if (params.priceMax != null) {
    and.push(
      params.pharmacyId
        ? {
            inventory: {
              some: {
                pharmacyId: params.pharmacyId,
                OR: [
                  { promoPrice: { lte: params.priceMax } },
                  { promoPrice: null, price: { lte: params.priceMax } },
                ],
              },
            },
          }
        : {
            OR: [
              { promoPrice: { lte: params.priceMax } },
              { promoPrice: null, price: { lte: params.priceMax } },
            ],
          },
    );
  }
  if (and.length > 0) where.AND = and;
  return where;
}
