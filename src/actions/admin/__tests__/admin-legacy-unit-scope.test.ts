import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertArea: vi.fn(),
  assertOwner: vi.fn(),
  requireAdminAtPharmacy: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  courierFindUnique: vi.fn(),
  courierUpdate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  assertArea: mocks.assertArea,
  assertOwner: mocks.assertOwner,
  requireAdminAtPharmacy: mocks.requireAdminAtPharmacy,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: mocks.orderFindUnique,
      update: mocks.orderUpdate,
      delete: vi.fn(),
    },
    courier: {
      findUnique: mocks.courierFindUnique,
      update: mocks.courierUpdate,
      create: vi.fn(),
    },
  },
}));
vi.mock("@/lib/orders", () => ({
  ORDER_STATUSES: ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELED"],
  cancelOrder: vi.fn(),
  transferOrder: vi.fn(),
  fulfillOrder: vi.fn(),
  isValidOrderTransition: vi.fn(),
  markOrderDelivered: vi.fn(),
  processOrderRefund: vi.fn(),
  transitionOrderStatus: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/communications/mail", () => ({ sendMail: vi.fn(), baseUrl: () => "http://localhost" }));
vi.mock("@/lib/communications/notifications", () => ({ notifyUnit: vi.fn() }));
vi.mock("@/lib/communications/email-templates", () => ({
  orderStatusEmail: vi.fn(),
  orderIncomingTransferEmail: vi.fn(),
}));

import { saveOrderNotes } from "@/actions/admin/orders";
import { toggleCourier } from "@/actions/admin/deliveries";

describe("escopo de registros administrativos legados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertArea.mockResolvedValue({ id: "staff-1" });
    mocks.requireAdminAtPharmacy.mockRejectedValue(new Error("outra unidade"));
  });

  it("não salva observações em pedido sem unidade sem passar pelo guard", async () => {
    mocks.orderFindUnique.mockResolvedValue({
      id: "order-1",
      pharmacyId: null,
      number: "FV-1",
    });

    await expect(saveOrderNotes("order-1", "nota")).rejects.toThrow("outra unidade");
    expect(mocks.requireAdminAtPharmacy).toHaveBeenCalledWith(null);
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it("não alterna entregador sem unidade sem passar pelo guard", async () => {
    mocks.courierFindUnique.mockResolvedValue({
      active: true,
      name: "Legado",
      pharmacyId: null,
    });

    await expect(toggleCourier("courier-1")).rejects.toThrow("outra unidade");
    expect(mocks.requireAdminAtPharmacy).toHaveBeenCalledWith(null);
    expect(mocks.courierUpdate).not.toHaveBeenCalled();
  });
});
