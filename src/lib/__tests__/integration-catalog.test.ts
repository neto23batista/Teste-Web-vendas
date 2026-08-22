import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const productFindMany = vi.fn();
  const productFindUnique = vi.fn();
  const productFindFirst = vi.fn();
  const productUpdate = vi.fn();
  const productCreate = vi.fn();
  const productCreateManyAndReturn = vi.fn();
  const categoryFindMany = vi.fn();
  const categoryCreateMany = vi.fn();
  const categoryUpsert = vi.fn();
  const inventoryUpsert = vi.fn();
  const inventoryCreateMany = vi.fn();
  const transaction = vi.fn();
  const prismaMock = {
    product: {
      findMany: (...args: unknown[]) => productFindMany(...args),
      findUnique: (...args: unknown[]) => productFindUnique(...args),
      findFirst: (...args: unknown[]) => productFindFirst(...args),
      update: (...args: unknown[]) => productUpdate(...args),
      create: (...args: unknown[]) => productCreate(...args),
      createManyAndReturn: (...args: unknown[]) => productCreateManyAndReturn(...args),
    },
    category: {
      findMany: (...args: unknown[]) => categoryFindMany(...args),
      createMany: (...args: unknown[]) => categoryCreateMany(...args),
      upsert: (...args: unknown[]) => categoryUpsert(...args),
    },
    inventory: {
      upsert: (...args: unknown[]) => inventoryUpsert(...args),
      createMany: (...args: unknown[]) => inventoryCreateMany(...args),
    },
  };
  return {
    productFindMany,
    productFindUnique,
    productFindFirst,
    productUpdate,
    productCreate,
    productCreateManyAndReturn,
    categoryFindMany,
    categoryCreateMany,
    categoryUpsert,
    inventoryUpsert,
    inventoryCreateMany,
    transaction,
    prismaMock,
  };
});

const {
  productFindMany,
  productFindUnique,
  productFindFirst,
  productUpdate,
  productCreate,
  productCreateManyAndReturn,
  categoryFindMany,
  categoryCreateMany,
  categoryUpsert,
  inventoryUpsert,
  inventoryCreateMany,
  transaction,
} = mocks;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...mocks.prismaMock,
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
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
  productFindMany.mockResolvedValue([]);
  productFindUnique.mockResolvedValue(null);
  productFindFirst.mockResolvedValue(null);
  productUpdate.mockResolvedValue({});
  productCreate.mockResolvedValue({ id: "novo1", sku: item.sku, ean: item.ean });
  productCreateManyAndReturn.mockImplementation(
    async ({ data }: { data: { sku: string }[] }) =>
      data.map((entry, index) => ({ id: `novo${index + 1}`, sku: entry.sku }))
  );
  categoryFindMany.mockResolvedValue([{ id: "cat1", slug: "medicamentos" }]);
  categoryCreateMany.mockResolvedValue({ count: 1 });
  categoryUpsert.mockResolvedValue({ id: "cat1" });
  inventoryUpsert.mockResolvedValue({});
  inventoryCreateMany.mockResolvedValue({ count: 1 });
  transaction.mockImplementation(async (callback: (tx: typeof mocks.prismaMock) => unknown) =>
    callback(mocks.prismaMock)
  );
});

describe("upsertCatalog", () => {
  it("precarrega os matches e atualiza preço/estoque sem consultas por item", async () => {
    productFindMany.mockResolvedValue([{ id: "p1", sku: item.sku, ean: null }]);

    const result = await upsertCatalog("farm1", [
      { ...item, preco: 9.99, estoque: 50 },
    ]);

    expect(result).toMatchObject({ updated: 1, created: 0, errors: [] });
    expect(productFindMany).toHaveBeenCalledTimes(1);
    expect(productFindUnique).not.toHaveBeenCalled();
    const updateData = productUpdate.mock.calls[0][0].data;
    expect(updateData.price).toBe("9.99");
    expect(updateData.name).toBeUndefined();
    expect(inventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_pharmacyId: { productId: "p1", pharmacyId: "farm1" } },
        update: { stock: 50 },
      })
    );
  });

  it("cria produtos novos e seus estoques com duas operações em lote", async () => {
    const items = Array.from({ length: 100 }, (_, index) => ({
      ...item,
      sku: `IF-${String(index).padStart(4, "0")}`,
      ean: `7891000${String(index).padStart(6, "0")}`,
    }));

    const result = await upsertCatalog("farm1", items);

    expect(result).toMatchObject({ created: 100, updated: 0, errors: [] });
    expect(productCreateManyAndReturn).toHaveBeenCalledTimes(1);
    expect(inventoryCreateMany).toHaveBeenCalledTimes(1);
    expect(productCreate).not.toHaveBeenCalled();
    const createData = productCreateManyAndReturn.mock.calls[0][0].data[0];
    expect(createData).toMatchObject({ active: false, categoryId: "cat1" });
    expect(createData.slug).toMatch(/^dipirona-500mg-[a-f0-9]{12}$/);
  });

  it("cria categorias ausentes uma vez por lote", async () => {
    categoryFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "cat1", slug: "medicamentos" }]);

    const result = await upsertCatalog("farm1", [item]);

    expect(result.created).toBe(1);
    expect(categoryCreateMany).toHaveBeenCalledTimes(1);
    expect(categoryCreateMany.mock.calls[0][0]).toMatchObject({
      data: [{ name: "Medicamentos", slug: "medicamentos", sort: 999 }],
      skipDuplicates: true,
    });
  });

  it("produto reclassificado como tarja sai da loja", async () => {
    productFindMany.mockResolvedValue([{ id: "p1", sku: item.sku, ean: null }]);

    await upsertCatalog("farm1", [{ ...item, tarja: true }]);

    expect(productUpdate.mock.calls[0][0].data).toMatchObject({
      requiresPrescription: true,
      active: false,
    });
  });

  it("tarja false não reverte a classificação nem republica o produto", async () => {
    productFindMany.mockResolvedValue([{ id: "p1", sku: item.sku, ean: null }]);

    await upsertCatalog("farm1", [{ ...item, tarja: false }]);

    const updateData = productUpdate.mock.calls[0][0].data;
    expect(updateData.active).toBeUndefined();
    expect(updateData.requiresPrescription).toBeUndefined();
  });

  it("faz match por EAN quando o SKU ainda não existe", async () => {
    productFindMany.mockResolvedValue([{ id: "p2", sku: null, ean: item.ean }]);

    const result = await upsertCatalog("farm1", [item]);

    expect(result.updated).toBe(1);
    expect(productUpdate.mock.calls[0][0].data.sku).toBe(item.sku);
  });

  it("ignora itens inválidos sem quebrar o lote", async () => {
    productFindMany.mockResolvedValue([{ id: "p1", sku: item.sku, ean: null }]);

    const result = await upsertCatalog("farm1", [
      { nome: "sem sku", preco: 10, estoque: 1 },
      { ...item, preco: "abc" },
      item,
    ]);

    expect(result).toMatchObject({ skipped: 2, updated: 1, errors: [] });
  });

  it("erro em um item não derruba o restante do lote", async () => {
    productFindMany.mockResolvedValue([
      { id: "p1", sku: "IF-0001", ean: null },
      { id: "p2", sku: "IF-0002", ean: null },
    ]);
    productUpdate.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "p1") throw new Error("db caiu");
      return {};
    });

    const result = await upsertCatalog("farm1", [item, { ...item, sku: "IF-0002" }]);

    expect(result.errors).toEqual([expect.stringContaining("IF-0001")]);
    expect(result.updated).toBe(1);
  });

  it("consolida SKUs repetidos preservando o efeito do último update", async () => {
    productFindMany.mockResolvedValue([{ id: "p1", sku: item.sku, ean: null }]);

    const result = await upsertCatalog("farm1", [
      item,
      { ...item, preco: 7.5, estoque: 33, tarja: true },
    ]);

    expect(productUpdate).toHaveBeenCalledTimes(1);
    expect(productUpdate.mock.calls[0][0].data).toMatchObject({
      price: "7.50",
      active: false,
      requiresPrescription: true,
    });
    expect(inventoryUpsert.mock.calls[0][0].update.stock).toBe(33);
    expect(result.updated).toBe(2);
  });

  it("faz fallback individual quando o createMany sofre rollback", async () => {
    transaction.mockRejectedValueOnce(new Error("constraint concorrente"));
    productCreate.mockResolvedValue({ id: "fallback1", sku: item.sku, ean: item.ean });

    const result = await upsertCatalog("farm1", [item]);

    expect(productCreate).toHaveBeenCalledTimes(1);
    expect(inventoryUpsert).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ created: 1, errors: [] });
  });
});
