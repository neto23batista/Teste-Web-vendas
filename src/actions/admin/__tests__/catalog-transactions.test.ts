import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  find: vi.fn(),
  slugFind: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  authorize: vi.fn(),
  ensure: vi.fn(),
  sync: vi.fn(),
  audit: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findUnique: mocks.find },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/catalog/admin-support", () => ({
  isCatalogAdmin: mocks.authorize,
  ensureInventoryForAllUnits: mocks.ensure,
  syncMatrizOffer: mocks.sync,
  revalidateProducts: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  requireAdmin: async () => ({ id: "admin-1", email: "admin@example.test" }),
}));
vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
  logAuditInTransaction: mocks.audit,
}));
vi.mock("@/lib/monitoring", () => ({ reportError: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createProduct, updateProduct } from "../products";

const tx = {
  product: {
    findUnique: mocks.slugFind,
    create: mocks.create,
    update: mocks.update,
  },
};
function form(stock = "99") {
  const value = new FormData();
  for (const [key, input] of Object.entries({
    name: "Produto",
    price: "10.00",
    categoryId: "category-1",
    stock,
    minStock: "5",
    active: "on",
  }))
    value.set(key, input);
  return value;
}

describe("catálogo e inventário na mesma transação", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authorize.mockResolvedValue(true);
    mocks.slugFind.mockResolvedValue(null);
    mocks.find.mockImplementation(({ where }) =>
      where.slug ? null : { requiresPrescription: false },
    );
    mocks.create.mockResolvedValue({ id: "product-1", name: "Produto" });
    mocks.transaction.mockImplementation((callback) => callback(tx));
  });

  it("cria produto, estoque inicial e auditoria no mesmo contexto transacional", async () => {
    await createProduct(undefined, form("7"));
    expect(mocks.slugFind).toHaveBeenCalledWith({ where: { slug: "produto" } });
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.ensure).toHaveBeenCalledWith(
      tx,
      "product-1",
      5,
      expect.anything(),
    );
    expect(mocks.sync).toHaveBeenCalledWith(
      tx,
      "product-1",
      5,
      expect.anything(),
      expect.objectContaining({ id: "admin-1" }),
      7,
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "product.create" }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/produtos");
  });

  it("ignora saldo antigo ou forjado ao editar o cadastro", async () => {
    await updateProduct("product-1", undefined, form("999"));
    expect(mocks.sync).toHaveBeenCalledWith(
      tx,
      "product-1",
      5,
      expect.anything(),
      expect.objectContaining({ id: "admin-1" }),
    );
    expect(mocks.sync.mock.calls[0]).toHaveLength(5);
    expect(mocks.update.mock.calls[0][0].where).toEqual({
      id: "product-1",
      requiresPrescription: false,
    });
  });

  it("falha de auditoria não é reportada como criação concluída", async () => {
    mocks.audit.mockRejectedValue(new Error("internal database detail"));
    const result = await createProduct(undefined, form());
    expect(result?.error).toMatch(/Não foi possível/);
    expect(result?.error).not.toContain("internal");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("recusa falta de autorização antes da transação", async () => {
    mocks.authorize.mockResolvedValue(false);
    expect((await createProduct(undefined, form()))?.error).toMatch(/matriz/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
