import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), requireAdminAtPharmacy: vi.fn(), transaction: vi.fn(),
  changeInventory: vi.fn(), lotAggregate: vi.fn(), transfer: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin, requireAdminAtPharmacy: mocks.requireAdminAtPharmacy, assertArea: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/inventory/movements", () => ({ changeInventory: mocks.changeInventory, InsufficientInventoryError: class extends Error {} }));
vi.mock("@/lib/inventory/lot-transfers", () => ({ transferPhysicalInventory: mocks.transfer }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(), logAuditInTransaction: mocks.audit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { adjustStock, transferStock } from "@/actions/admin/inventory";

describe("integridade dos ajustes administrativos", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "staff-1", pharmacyType: "MATRIZ", staffProfile: "OWNER" });
    mocks.requireAdminAtPharmacy.mockResolvedValue({ id: "staff-1" });
    mocks.transaction.mockImplementation((callback) => callback({ inventoryLot: { aggregate: mocks.lotAggregate } }));
    mocks.changeInventory.mockResolvedValue({ inventoryId: "inventory-1", stockBefore: 10, stockAfter: 7 });
    mocks.lotAggregate.mockResolvedValue({ _sum: { qty: 8 } });
  });

  it("não permite que um ajuste genérico diminua estoque rastreado sem baixar o lote", async () => {
    expect(await adjustStock("product-1", "unit-a", -3, "Conferência")).toEqual({ ok: false, error: expect.stringMatching(/baixa no lote/) });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("permite ajustar somente a parcela não rastreada", async () => {
    mocks.lotAggregate.mockResolvedValue({ _sum: { qty: 7 } });
    expect(await adjustStock("product-1", "unit-a", -3, "Conferência")).toEqual({ ok: true });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

  it.each([1.5, 0, -1, NaN, Infinity, 100001, "2"])("não arredonda quantidade de transferência: %s", async (qty) => {
    expect((await transferStock("product-1", "unit-a", "unit-b", qty as number)).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("usa a transferência rastreável dentro da transação com auditoria", async () => {
    expect(await transferStock("product-1", "unit-a", "unit-b", 3)).toEqual({ ok: true });
    expect(mocks.transfer).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      productId: "product-1", fromPharmacyId: "unit-a", toPharmacyId: "unit-b", qty: 3, transferId: expect.any(String),
    }));
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
});
