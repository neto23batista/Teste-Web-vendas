import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  categoryFindMany: vi.fn(),
  brandFindMany: vi.fn(),
  productFindMany: vi.fn(),
  productFindUnique: vi.fn(),
  productUpdate: vi.fn(),
  productCreate: vi.fn(),
  productCreateMany: vi.fn(),
  pharmacyFindMany: vi.fn(),
  pharmacyFindFirst: vi.fn(),
  inventoryCreateMany: vi.fn(),
  inventoryCreateManyOutsideTransaction: vi.fn(),
  inventoryUpsert: vi.fn(),
  inventoryLots: vi.fn(),
  movementCreate: vi.fn(),
  movementCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

const txMock = {
  product: {
    update: (...args: unknown[]) => mocks.productUpdate(...args),
    create: (...args: unknown[]) => mocks.productCreate(...args),
    createMany: (...args: unknown[]) => mocks.productCreateMany(...args),
  },
  inventory: {
    upsert: (...args: unknown[]) => mocks.inventoryUpsert(...args),
    createMany: (...args: unknown[]) => mocks.inventoryCreateMany(...args),
  },
  inventoryLot: {
    aggregate: (...args: unknown[]) => mocks.inventoryLots(...args),
  },
  inventoryMovement: {
    create: (...args: unknown[]) => mocks.movementCreate(...args),
    createMany: (...args: unknown[]) => mocks.movementCreateMany(...args),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findMany: (...args: unknown[]) => mocks.categoryFindMany(...args),
    },
    brand: { findMany: (...args: unknown[]) => mocks.brandFindMany(...args) },
    product: {
      findMany: (...args: unknown[]) => mocks.productFindMany(...args),
      findUnique: (...args: unknown[]) => mocks.productFindUnique(...args),
      update: (...args: unknown[]) => mocks.productUpdate(...args),
      create: (...args: unknown[]) => mocks.productCreate(...args),
      createMany: (...args: unknown[]) => mocks.productCreateMany(...args),
    },
    pharmacy: {
      findMany: (...args: unknown[]) => mocks.pharmacyFindMany(...args),
      findFirst: (...args: unknown[]) => mocks.pharmacyFindFirst(...args),
    },
    inventory: {
      createMany: (...args: unknown[]) =>
        mocks.inventoryCreateManyOutsideTransaction(...args),
      upsert: (...args: unknown[]) => mocks.inventoryUpsert(...args),
    },
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));
vi.mock("@/lib/auth/session", () => ({
  requireAdmin: (...args: unknown[]) => mocks.requireAdmin(...args),
  assertArea: vi.fn(),
  requireAdminAtPharmacy: vi.fn(),
}));
vi.mock("@/lib/auth/permissions", () => ({ canAccess: () => true }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ reportError: vi.fn() }));

import { importProducts } from "@/actions/admin/product-import";

const header =
  "nome,sku,ean,preco,promo,estoque,categoria,marca,principio_ativo,descricao,generico,tarja";

function formWithRows(rows: string[]): FormData {
  const form = new FormData();
  form.set(
    "file",
    new File([[header, ...rows].join("\r\n")], "produtos.csv", {
      type: "text/csv",
    }),
  );
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    pharmacyType: "MATRIZ",
    staffProfile: "OWNER",
  });
  mocks.categoryFindMany.mockResolvedValue([
    { id: "cat1", name: "Medicamentos", slug: "medicamentos" },
  ]);
  mocks.brandFindMany.mockResolvedValue([]);
  mocks.productFindMany.mockResolvedValue([]);
  mocks.productFindUnique.mockResolvedValue(null);
  mocks.productUpdate.mockResolvedValue({});
  mocks.productCreate.mockResolvedValue({});
  mocks.productCreateMany.mockResolvedValue({ count: 1 });
  mocks.pharmacyFindMany.mockResolvedValue([
    { id: "matriz" },
    { id: "filial" },
  ]);
  mocks.pharmacyFindFirst.mockResolvedValue({ id: "matriz" });
  mocks.inventoryCreateMany.mockResolvedValue({ count: 1 });
  mocks.inventoryCreateManyOutsideTransaction.mockResolvedValue({ count: 1 });
  let currentStock = 0;
  mocks.inventoryUpsert.mockImplementation(({ update }) => {
    if (update.stock?.increment) currentStock += update.stock.increment;
    return { id: "inventory-1", stock: currentStock };
  });
  mocks.inventoryLots.mockResolvedValue({ _sum: { qty: 0 } });
  mocks.movementCreateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return (arg as (tx: typeof txMock) => unknown)(txMock);
  });
});

describe("importProducts em lote", () => {
  it("cria 100 produtos e inventários com um batch, sem lookup por linha", async () => {
    const rows = Array.from({ length: 100 }, (_, index) =>
      [
        `Produto ${index}`,
        `SKU-${index}`,
        `789${String(index).padStart(10, "0")}`,
        "10.00",
        "",
        String(index),
        "Medicamentos",
        "",
        "",
        "Descrição",
        "nao",
        "nao",
      ].join(","),
    );

    const result = await importProducts(formWithRows(rows));

    expect(result).toMatchObject({
      ok: true,
      created: 100,
      updated: 0,
      errors: [],
    });
    expect(mocks.productFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.productFindUnique).not.toHaveBeenCalled();
    expect(mocks.productCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.inventoryCreateMany).toHaveBeenCalledTimes(1);
    const products = mocks.productCreateMany.mock.calls[0][0].data;
    expect(products).toHaveLength(100);
    expect(products[0]).toMatchObject({ sku: "SKU-0", active: false });
    const inventories = mocks.inventoryCreateMany.mock.calls[0][0].data;
    expect(inventories).toHaveLength(200);
    expect(inventories).toContainEqual(
      expect.objectContaining({ pharmacyId: "matriz", stock: 0 }),
    );
  });

  it("consolida SKU repetido e mantém tarja como restrição monotônica", async () => {
    mocks.productFindMany.mockResolvedValue([
      { id: "p1", sku: "REP-1", requiresPrescription: false },
    ]);
    const first =
      "Produto inicial,REP-1,,10,,5,Medicamentos,,,Primeira,nao,sim";
    const last = "Produto final,REP-1,,12,,9,Medicamentos,,,Segunda,nao,nao";

    const result = await importProducts(formWithRows([first, last]));

    expect(result).toMatchObject({
      ok: true,
      created: 0,
      updated: 2,
      errors: [],
    });
    expect(mocks.productUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.productUpdate.mock.calls[0][0].data).toMatchObject({
      name: "Produto final",
      price: "12.00",
      requiresPrescription: true,
      active: false,
    });
    expect(mocks.inventoryUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.inventoryUpsert.mock.calls[0][0].update).not.toHaveProperty(
      "stock",
    );
    expect(mocks.movementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        delta: 9,
        stockBefore: 0,
        stockAfter: 9,
      }),
    });
  });

  it("recusa uma contagem CSV que consumiria saldo rastreado", async () => {
    mocks.productFindMany.mockResolvedValue([
      { id: "p1", sku: "REP-1", requiresPrescription: false },
    ]);
    mocks.inventoryLots.mockResolvedValue({ _sum: { qty: 8 } });
    const result = await importProducts(
      formWithRows(["Produto,REP-1,,10,,3,Medicamentos,,,,nao,nao"]),
    );
    expect(result.updated).toBe(0);
    expect(result.errors[0]).toMatch(/baixa no lote/);
    expect(mocks.movementCreate).not.toHaveBeenCalled();
    expect(mocks.inventoryCreateManyOutsideTransaction).not.toHaveBeenCalled();
  });

  it("preserva o saldo quando a coluna de estoque está vazia", async () => {
    mocks.productFindMany.mockResolvedValue([
      { id: "p1", sku: "REP-1", requiresPrescription: false },
    ]);
    mocks.inventoryUpsert.mockResolvedValue({ id: "inventory-1", stock: 12 });
    const result = await importProducts(
      formWithRows(["Produto,REP-1,,10,,,Medicamentos,,,,nao,nao"]),
    );
    expect(result).toMatchObject({ updated: 1, errors: [] });
    expect(mocks.inventoryUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.inventoryUpsert.mock.calls[0][0].update).not.toHaveProperty(
      "stock",
    );
    expect(mocks.movementCreate).not.toHaveBeenCalled();
    expect(mocks.inventoryLots).not.toHaveBeenCalled();
  });

  it("cria produtos sem contagem com saldo zero e sem movimento fictício", async () => {
    const result = await importProducts(
      formWithRows(["Produto,NOVO,,10,,,Medicamentos,,,,nao,nao"]),
    );
    expect(result).toMatchObject({ created: 1, errors: [] });
    expect(mocks.inventoryCreateMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ pharmacyId: "matriz", stock: 0 }),
      expect.objectContaining({ pharmacyId: "filial", stock: 0 }),
    ]);
    expect(mocks.movementCreateMany).not.toHaveBeenCalled();
  });

  it("preserva a última contagem explícita entre linhas duplicadas", async () => {
    mocks.productFindMany.mockResolvedValue([
      { id: "p1", sku: "REP-1", requiresPrescription: false },
    ]);
    const result = await importProducts(
      formWithRows([
        "Produto,REP-1,,10,,5,Medicamentos,,,,nao,nao",
        "Produto atualizado,REP-1,,12,,,Medicamentos,,,,nao,nao",
      ]),
    );
    expect(result).toMatchObject({ updated: 2, errors: [] });
    expect(mocks.movementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ delta: 5, stockAfter: 5 }),
    });
  });

  it.each(["-1", "1.5", "inválido", "2147483648", '"2,5"', "9007199254740992"])(
    "recusa estoque inválido %s sem arredondar ou converter em zero",
    async (stock) => {
      const result = await importProducts(
        formWithRows([`Produto,SKU,,10,,${stock},Medicamentos,,,,nao,nao`]),
      );
      expect(result).toMatchObject({ created: 0, updated: 0 });
      expect(result.errors[0]).toMatch(/estoque inválido/);
      expect(mocks.productCreateMany).not.toHaveBeenCalled();
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it("não cria ofertas antecipadamente quando a atualização do produto falha", async () => {
    mocks.productFindMany.mockResolvedValue([
      { id: "p1", sku: "REP-1", requiresPrescription: false },
    ]);
    mocks.productUpdate.mockRejectedValue(new Error("transaction failed"));
    const result = await importProducts(
      formWithRows(["Produto,REP-1,,10,,3,Medicamentos,,,,nao,nao"]),
    );
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(mocks.inventoryCreateMany).not.toHaveBeenCalled();
    expect(mocks.inventoryCreateManyOutsideTransaction).not.toHaveBeenCalled();
  });

  it("recusa mais de 2.000 linhas antes de consultar o catálogo", async () => {
    const row = "Produto,SKU,7891,10,,5,Medicamentos,,,,nao,nao";
    const result = await importProducts(
      formWithRows(Array.from({ length: 2_001 }, () => row)),
    );

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("2.000");
    expect(mocks.categoryFindMany).not.toHaveBeenCalled();
    expect(mocks.productFindMany).not.toHaveBeenCalled();
  });
});
