import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertArea: vi.fn(),
  requireAdminAtPharmacy: vi.fn(),
  transaction: vi.fn(),
  lockInventory: vi.fn(),
  inventoryFindUnique: vi.fn(),
  lotFindUnique: vi.fn(),
  lotFindFirst: vi.fn(),
  lotUpsert: vi.fn(),
  lotUpdateMany: vi.fn(),
  changeInventory: vi.fn(),
  audit: vi.fn(),
  reportError: vi.fn(),
  revalidateTag: vi.fn(),
}));

const tx = {
  $queryRaw: mocks.lockInventory,
  inventory: { findUnique: mocks.inventoryFindUnique },
  inventoryLot: {
    findUnique: mocks.lotFindUnique,
    findFirst: mocks.lotFindFirst,
    upsert: mocks.lotUpsert,
    updateMany: mocks.lotUpdateMany,
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/auth/session", () => ({
  assertArea: mocks.assertArea,
  requireAdminAtPharmacy: mocks.requireAdminAtPharmacy,
}));
vi.mock("@/lib/inventory/movements", () => ({
  changeInventory: mocks.changeInventory,
  InsufficientInventoryError: class extends Error {},
}));
vi.mock("@/lib/audit", () => ({ logAuditInTransaction: mocks.audit }));
vi.mock("@/lib/monitoring", () => ({ reportError: mocks.reportError }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: mocks.revalidateTag }));

import { receiveInventoryLot, writeOffInventoryLot } from "@/actions/admin/inventory-lots";

const receipt = {
  productId: "product-1",
  pharmacyId: "pharmacy-1",
  lotCode: "lote-1",
  expiresOn: "2027-03-10",
  qty: 4,
};

describe("recebimento e baixa de lotes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T18:00:00.000Z"));
    mocks.requireAdminAtPharmacy.mockResolvedValue({ id: "staff-1", email: "staff@example.test" });
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    mocks.lockInventory.mockResolvedValue([{ id: "inventory-1" }]);
    mocks.inventoryFindUnique.mockResolvedValue({ id: "inventory-1" });
    mocks.lotFindUnique.mockResolvedValue(null);
    mocks.lotFindFirst.mockResolvedValue({ id: "lot-1", productId: "product-1", lotCode: "LOTE-1" });
    mocks.lotUpsert.mockResolvedValue({ id: "lot-1" });
    mocks.lotUpdateMany.mockResolvedValue({ count: 1 });
    mocks.changeInventory.mockResolvedValue({ stockBefore: 3, stockAfter: 7 });
  });

  afterEach(() => vi.useRealTimers());

  it.each([1.5, -0.5, 0, -1, 100001, NaN, Infinity, "4", null])(
    "recusa quantidade inválida no recebimento: %s",
    async (qty) => {
      const result = await receiveInventoryLot({ ...receipt, qty: qty as number });
      expect(result.ok).toBe(false);
      expect(mocks.transaction).not.toHaveBeenCalled();
    }
  );

  it("recusa datas impossíveis em vez de normalizá-las para outro mês", async () => {
    const result = await receiveInventoryLot({ ...receipt, expiresOn: "2027-02-30" });
    expect(result.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("não altera a validade de um lote já cadastrado", async () => {
    mocks.lotFindUnique.mockResolvedValue({ id: "lot-1", expiresAt: new Date("2027-02-10T12:00:00.000Z") });
    const result = await receiveInventoryLot(receipt);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/validade/i) });
    expect(mocks.lotUpsert).not.toHaveBeenCalled();
    expect(mocks.changeInventory).not.toHaveBeenCalled();
  });

  it("recebe na unidade autorizada, trava o estoque antes do lote e registra a auditoria", async () => {
    const result = await receiveInventoryLot(receipt);
    expect(result.ok).toBe(true);
    expect(mocks.assertArea).toHaveBeenCalledWith("compras");
    expect(mocks.requireAdminAtPharmacy).toHaveBeenCalledWith("pharmacy-1");
    expect(mocks.lockInventory).toHaveBeenCalledOnce();
    expect(mocks.lockInventory.mock.invocationCallOrder[0]).toBeLessThan(mocks.lotUpsert.mock.invocationCallOrder[0]);
    expect(mocks.lotUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ lotCode: "LOTE-1", qty: 4 }),
      update: expect.not.objectContaining({ expiresAt: expect.anything() }),
    }));
    expect(mocks.changeInventory).toHaveBeenCalledWith(tx, expect.objectContaining({
      delta: 4, kind: "RECEIPT", referenceId: "lot-1", pharmacyId: "pharmacy-1",
    }));
    expect(mocks.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "inventory.lot.receive" }));
  });

  it("mantém a validade do dia até o fim do dia em São Paulo", async () => {
    vi.setSystemTime(new Date("2026-09-03T02:59:59.000Z"));
    expect((await receiveInventoryLot({ ...receipt, expiresOn: "2026-09-02" })).ok).toBe(true);
    vi.setSystemTime(new Date("2026-09-03T03:00:00.000Z"));
    expect((await receiveInventoryLot({ ...receipt, expiresOn: "2026-09-02" })).ok).toBe(false);
  });

  it("não recebe em unidade fora do escopo", async () => {
    mocks.requireAdminAtPharmacy.mockRejectedValue(new Error("Acesso negado"));
    await expect(receiveInventoryLot(receipt)).rejects.toThrow("Acesso negado");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("não expõe detalhes internos quando o banco falha", async () => {
    mocks.transaction.mockRejectedValue(new Error("database-internal-detail"));
    const result = await receiveInventoryLot(receipt);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("database-internal-detail");
    expect(mocks.reportError).toHaveBeenCalledOnce();
  });

  it.each([1.5, -0.5, NaN, "2"])("recusa baixa com quantidade inválida: %s", async (qty) => {
    const result = await writeOffInventoryLot({ lotId: "lot-1", pharmacyId: "pharmacy-1", qty: qty as number, reason: "Avaria" });
    expect(result.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("baixa com a mesma ordem de travas do recebimento e das reservas", async () => {
    const result = await writeOffInventoryLot({ lotId: "lot-1", pharmacyId: "pharmacy-1", qty: 2, reason: "Avaria" });
    expect(result.ok).toBe(true);
    expect(mocks.lockInventory).toHaveBeenCalledOnce();
    expect(mocks.lockInventory.mock.invocationCallOrder[0]).toBeLessThan(mocks.lotUpdateMany.mock.invocationCallOrder[0]);
    expect(mocks.changeInventory).toHaveBeenCalledWith(tx, expect.objectContaining({ delta: -2, kind: "LOSS" }));
  });

  it("não baixa o estoque global se o saldo do lote mudou", async () => {
    mocks.lotUpdateMany.mockResolvedValue({ count: 0 });
    const result = await writeOffInventoryLot({ lotId: "lot-1", pharmacyId: "pharmacy-1", qty: 2, reason: "Avaria" });
    expect(result.ok).toBe(false);
    expect(mocks.changeInventory).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
