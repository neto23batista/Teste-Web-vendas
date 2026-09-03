import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireArea: vi.fn(), detail: vi.fn(), list: vi.fn(), pharmacies: vi.fn(), store: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireArea: mocks.requireArea }));
vi.mock("@/lib/admin", () => ({ getAdminOrder: mocks.detail, getAdminOrders: mocks.list }));
vi.mock("@/lib/pharmacy", () => ({ listPharmaciesSafe: mocks.pharmacies }));
vi.mock("@/lib/settings", () => ({ getStoreSettings: mocks.store }));
vi.mock("@/lib/orders/transfer", () => ({ TRANSFERABLE_STATUSES: ["PENDING", "PAID", "PREPARING"] }));

import { getAdminOrderDetailView, getAdminOrdersView } from "./orders";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireArea.mockResolvedValue({ staffProfile: "OWNER" });
  mocks.pharmacies.mockResolvedValue([{ id: "unit-1", name: "A" }, { id: "unit-2", name: "B" }]);
  mocks.store.mockResolvedValue({ cnpj: "", address: "Rua A", phone: "123", internal: "not-for-view" });
});

describe("admin order view", () => {
  it("enforces the page area before reading orders", async () => {
    mocks.requireArea.mockRejectedValue(new Error("Acesso negado"));
    await expect(getAdminOrderDetailView("order-1")).rejects.toThrow("Acesso negado");
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it("preserves a missing or out-of-scope result from the scoped repository", async () => {
    mocks.detail.mockResolvedValue(null);
    expect(await getAdminOrderDetailView("another-unit-order")).toBeNull();
  });

  it("removes raw provider errors and computes available operations before presentation", async () => {
    mocks.detail.mockResolvedValue({
      id: "order-1", number: "FV-123", status: "CANCELED", paymentMethod: "card",
      pharmacyId: "unit-1", items: [], archivedAt: null,
      payment: { status: "REFUND_FAILED", raw: "raw-provider-secret", refundError: "Stripe SQL secret", reconciliationError: "Database connection secret" },
      returnRequests: [{ id: "return-1", refundError: "secret-refund-details", items: [] }],
    });
    const view = await getAdminOrderDetailView("order-1");
    expect(view?.canTransfer).toBe(false);
    expect(view?.allowedTransitions).toEqual([]);
    expect(view?.order.payment?.refundError).toContain("FV-123");
    expect(view?.order.returnRequests[0].refundError).toContain("FV-123");
    expect(JSON.stringify(view)).not.toMatch(/secret|not-for-view/);
  });

  it("normalizes untrusted status and fractional pagination without passing invalid Prisma enums", async () => {
    mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pages: 1, perPage: 20 });
    const view = await getAdminOrdersView({ status: "NOT_A_STATUS", page: 1.9 });
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }), 1, undefined);
    expect(view.status).toBeUndefined();
  });
});
