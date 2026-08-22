import { beforeEach, describe, expect, it, vi } from "vitest";

const productFindMany = vi.fn();
const productFindFirst = vi.fn();
const productCount = vi.fn();
const queryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => productFindMany(...args),
      findFirst: (...args: unknown[]) => productFindFirst(...args),
      count: (...args: unknown[]) => productCount(...args),
    },
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (callback: (...args: unknown[]) => unknown) => callback,
}));

import {
  getProductMetadataBySlug,
  getProductSuggestions,
  searchProducts,
} from "@/lib/products";

const card = (id: string, name: string, price: number, promoPrice: number | null = null) => ({
  id,
  name,
  slug: name.toLowerCase(),
  emoji: null,
  price,
  promoPrice,
  isGeneric: false,
  rating: 4.5,
  ratingCount: 10,
  category: { name: "Medicamentos", slug: "medicamentos" },
  brand: null,
  images: [],
  inventory: [{ stock: 5 }],
});

beforeEach(() => {
  vi.clearAllMocks();
  productFindMany.mockResolvedValue([]);
  productFindFirst.mockResolvedValue(null);
  productCount.mockResolvedValue(0);
  queryRaw.mockResolvedValue([]);
});

describe("consultas públicas de produto", () => {
  it("autocomplete usa uma query leve, sem count, estoque ou janela de relevância", async () => {
    queryRaw.mockResolvedValue([
      {
        name: "Dipirona 500mg",
        slug: "dipirona-500mg",
        emoji: "💊",
        image: "/dipirona.webp",
        price: 9.9,
        oldPrice: 12,
        category: "Medicamentos",
      },
    ]);

    const result = await getProductSuggestions("dipirona", 6);

    expect(result).toEqual([
      {
        name: "Dipirona 500mg",
        slug: "dipirona-500mg",
        emoji: "💊",
        image: "/dipirona.webp",
        price: 9.9,
        oldPrice: 12,
        category: "Medicamentos",
      },
    ]);
    expect(productFindMany).not.toHaveBeenCalled();
    expect(productCount).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    const text = sql.strings.join(" ");
    expect(text).not.toContain("COUNT");
    expect(text).not.toContain("Inventory");
    expect(text).toContain("LIMIT");
    expect(sql.values).toContain(6);
  });

  it("metadados carregam apenas nome e descrição curta", async () => {
    productFindFirst.mockResolvedValue({ name: "Vitamina C", shortDescription: "500mg" });

    const result = await getProductMetadataBySlug("vitamina-c");

    expect(result?.name).toBe("Vitamina C");
    expect(productFindFirst).toHaveBeenCalledWith({
      where: {
        slug: "vitamina-c",
        active: true,
        requiresPrescription: false,
      },
      select: { name: true, shortDescription: true },
    });
  });

  it("ordena por preço efetivo e preserva a ordem dos IDs retornados pelo banco", async () => {
    queryRaw.mockResolvedValue([
      { id: "promo", total: 2 },
      { id: "normal", total: 2 },
    ]);
    productFindMany.mockResolvedValue([
      card("normal", "Normal", 8),
      card("promo", "Promo", 20, 5),
    ]);

    const result = await searchProducts({ sort: "menor", page: 1, perPage: 12 });

    expect(result.items.map((product) => product.id)).toEqual(["promo", "normal"]);
    expect(result.total).toBe(2);
    expect(productCount).not.toHaveBeenCalled();
    const sql = queryRaw.mock.calls[0][0] as { strings: string[] };
    expect(sql.strings.join(" ")).toContain('COALESCE(p."promoPrice", p."price")');
  });

  it("consulta o count somente quando a página de preço está vazia", async () => {
    queryRaw.mockResolvedValue([]);
    productCount.mockResolvedValue(25);

    const result = await searchProducts({ sort: "maior", page: 99, perPage: 12 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(25);
    expect(productCount).toHaveBeenCalledTimes(1);
    expect(productFindMany).not.toHaveBeenCalled();
  });
});
