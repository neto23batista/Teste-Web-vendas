import { describe, it, expect, vi, beforeEach } from "vitest";

const productFindUnique = vi.fn();
const productFindFirst = vi.fn();
const productUpdate = vi.fn();
const productCreate = vi.fn();
const categoryUpsert = vi.fn();
const inventoryUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: (...a: unknown[]) => productFindUnique(...a),
      findFirst: (...a: unknown[]) => productFindFirst(...a),
      update: (...a: unknown[]) => productUpdate(...a),
      create: (...a: unknown[]) => productCreate(...a),
    },
    category: { upsert: (...a: unknown[]) => categoryUpsert(...a) },
    inventory: { upsert: (...a: unknown[]) => inventoryUpsert(...a) },
  },
}));

vi.mock("next/cache", () => ({ revalidateTag: () => {} }));

import { upsertCatalog } from "@/lib/integration-catalog";

const item = {
  sku: "IF-0001",
  ean: "7891000315507",
  nome: "Dipirona 500mg",
  preco: 8.9,
  promo: null,
  estoque: 120,
  tarja: false,
  categoria: "Medicamentos",
};

beforeEach(() => {
  vi.clearAllMocks();
  categoryUpsert.mockResolvedValue({ id: "cat1" });
  productCreate.mockResolvedValue({ id: "novo1", sku: "IF-0001" });
  productUpdate.mockResolvedValue({});
  inventoryUpsert.mockResolvedValue({});
  // uniqueSlug consulta por slug — null = slug livre.
  productFindUnique.mockResolvedValue(null);
  productFindFirst.mockResolvedValue(null);
});

describe("upsertCatalog", () => {
  it("produto existente (por SKU): atualiza preço e estoque, preserva curadoria", async () => {
    productFindUnique.mockResolvedValueOnce({ id: "p1", sku: "IF-0001", ean: null });
    const r = await upsertCatalog("farm1", [{ ...item, preco: 9.99, estoque: 50 }]);

    expect(r.updated).toBe(1);
    expect(r.created).toBe(0);
    const updateData = productUpdate.mock.calls[0][0].data;
    expect(updateData.price).toBe(9.99);
    // nome/descrição NÃO são sobrescritos (curadoria do admin prevalece)
    expect(updateData.name).toBeUndefined();
    expect(inventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_pharmacyId: { productId: "p1", pharmacyId: "farm1" } },
        update: { stock: 50 },
      })
    );
  });

  it("produto novo: criado INATIVO com categoria fallback e estoque na unidade", async () => {
    const r = await upsertCatalog("farm1", [item]);

    expect(r.created).toBe(1);
    const createData = productCreate.mock.calls[0][0].data;
    expect(createData.active).toBe(false);
    expect(createData.sku).toBe("IF-0001");
    expect(createData.categoryId).toBe("cat1");
    expect(inventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pharmacyId: "farm1", stock: 120 }),
      })
    );
  });

  it("produto existente reclassificado como tarja sai da loja (active:false)", async () => {
    productFindUnique.mockResolvedValueOnce({ id: "p1", sku: "IF-0001", ean: null });
    const r = await upsertCatalog("farm1", [{ ...item, tarja: true }]);

    expect(r.updated).toBe(1);
    const updateData = productUpdate.mock.calls[0][0].data;
    expect(updateData.requiresPrescription).toBe(true);
    expect(updateData.active).toBe(false);
  });

  it("produto existente SEM tarja não mexe no active (curadoria preservada)", async () => {
    productFindUnique.mockResolvedValueOnce({ id: "p1", sku: "IF-0001", ean: null });
    await upsertCatalog("farm1", [{ ...item, tarja: false }]);

    const updateData = productUpdate.mock.calls[0][0].data;
    expect(updateData.active).toBeUndefined();
  });

  it("match por EAN quando o SKU ainda não existe: vincula o SKU", async () => {
    productFindUnique.mockResolvedValueOnce(null); // por sku: nada
    productFindFirst.mockResolvedValueOnce({ id: "p2", sku: null, ean: item.ean });
    const r = await upsertCatalog("farm1", [item]);

    expect(r.updated).toBe(1);
    expect(productUpdate.mock.calls[0][0].data.sku).toBe("IF-0001");
  });

  it("item inválido (sem sku/preço) é ignorado sem quebrar o lote", async () => {
    productFindUnique.mockResolvedValueOnce({ id: "p1", sku: "IF-0001", ean: null });
    const r = await upsertCatalog("farm1", [
      { nome: "sem sku", preco: 10, estoque: 1 },
      { ...item, preco: "abc" },
      item,
    ]);

    expect(r.skipped).toBe(2);
    expect(r.updated).toBe(1);
    expect(r.errors).toHaveLength(0);
  });

  it("erro num item não derruba o restante do lote", async () => {
    productFindUnique
      .mockRejectedValueOnce(new Error("db caiu"))
      .mockResolvedValueOnce({ id: "p1", sku: "IF-0002", ean: null });
    const r = await upsertCatalog("farm1", [item, { ...item, sku: "IF-0002" }]);

    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain("IF-0001");
    expect(r.updated).toBe(1);
  });
});
