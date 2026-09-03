import { beforeEach, describe, expect, it, vi } from "vitest";

const orderFindUnique = vi.fn();
const orderUpdateMany = vi.fn();
const requireAdminAtPharmacy = vi.fn();
const logAudit = vi.fn();
const logAuditInTransaction = vi.fn();

// Arquivar/restaurar gravam a mudança e a evidência no mesmo commit.
const tx = {
  order: { updateMany: (...args: unknown[]) => orderUpdateMany(...args) },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: (...args: unknown[]) => orderFindUnique(...args),
      updateMany: (...args: unknown[]) => orderUpdateMany(...args),
      update: vi.fn(),
    },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));
vi.mock("@/lib/auth/session", () => ({
  assertOwner: vi.fn(async () => ({ id: "owner" })),
  assertArea: vi.fn(),
  requireAdminAtPharmacy: (...args: unknown[]) => requireAdminAtPharmacy(...args),
}));
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
  logAuditInTransaction: (...args: unknown[]) => logAuditInTransaction(...args),
}));
vi.mock("@/lib/orders", () => ({
  ORDER_STATUSES: [],
  cancelOrder: vi.fn(),
  transferOrder: vi.fn(),
  fulfillOrder: vi.fn(),
  isValidOrderTransition: vi.fn(),
  markOrderDelivered: vi.fn(),
  processOrderRefund: vi.fn(),
  transitionOrderStatus: vi.fn(),
}));
vi.mock("@/lib/communications/mail", () => ({ sendMail: vi.fn(), baseUrl: () => "https://example.com" }));
vi.mock("@/lib/communications/notifications", () => ({ notifyUnit: vi.fn() }));
vi.mock("@/lib/communications/email-templates", () => ({
  orderStatusEmail: vi.fn(),
  orderIncomingTransferEmail: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { archiveOrder, restoreOrder } from "@/actions/admin/orders";

beforeEach(() => {
  vi.clearAllMocks();
  orderUpdateMany.mockResolvedValue({ count: 1 });
  // O guard devolve o ator, que vai junto na evidência gravada na transação.
  requireAdminAtPharmacy.mockResolvedValue({
    id: "staff-1",
    email: "staff@example.test",
  });
});

describe("histórico de pedidos", () => {
  it("arquiva pedido encerrado sem apagar o registro", async () => {
    orderFindUnique.mockResolvedValue({
      number: "FV1",
      pharmacyId: "ph-1",
      status: "DELIVERED",
      archivedAt: null,
    });

    await expect(archiveOrder("o1")).resolves.toEqual({ ok: true });
    expect(requireAdminAtPharmacy).toHaveBeenCalledWith("ph-1");
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "o1",
        archivedAt: null,
        status: { in: ["CANCELED", "DELIVERED"] },
      },
      data: { archivedAt: expect.any(Date) },
    });
    // A evidência sai na MESMA transação do arquivamento.
    expect(logAuditInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "order.archive",
        entityId: "o1",
        actor: { id: "staff-1", email: "staff@example.test" },
      })
    );
  });

  it("não arquiva pedido ainda operacional", async () => {
    orderFindUnique.mockResolvedValue({
      number: "FV2",
      pharmacyId: "ph-1",
      status: "PREPARING",
      archivedAt: null,
    });

    const result = await archiveOrder("o2");
    expect(result).toMatchObject({ ok: false });
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it("restaura o arquivo de forma reversível", async () => {
    orderFindUnique.mockResolvedValue({
      number: "FV1",
      pharmacyId: "ph-1",
      archivedAt: new Date(),
    });

    await expect(restoreOrder("o1")).resolves.toEqual({ ok: true });
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: "o1", archivedAt: { not: null } },
      data: { archivedAt: null },
    });
  });
});
