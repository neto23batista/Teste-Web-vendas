import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  create: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { create: mocks.create } },
}));
vi.mock("@/lib/monitoring", () => ({
  reportError: mocks.reportError,
}));

import { logAudit, logAuditInTransaction } from "@/lib/audit";

describe("auditoria durável", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
    });
    mocks.create.mockResolvedValue({ id: "audit-1" });
  });

  it("aguarda o INSERT e persiste o ator da sessão", async () => {
    await logAudit({
      action: "order.status",
      entity: "Order",
      entityId: "order-1",
      detail: "Pedido separado",
      pharmacyId: "pharmacy-1",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        userEmail: "owner@example.com",
        action: "order.status",
        entity: "Order",
        entityId: "order-1",
        detail: "Pedido separado",
        pharmacyId: "pharmacy-1",
      },
    });
  });

  it("aceita ator explícito sem reler uma sessão já revogada", async () => {
    await logAudit({
      action: "security.session.revoke",
      actor: { id: "user-2", email: "admin@example.com" },
    });

    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-2",
        userEmail: "admin@example.com",
      }),
    });
  });

  it("usa o TransactionClient e exige o ator já capturado", async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: "audit-tx" });
    const tx = { auditLog: { create: txCreate } };

    await logAuditInTransaction(tx as never, {
      action: "finance.expense.create",
      entity: "Expense",
      entityId: "expense-1",
      actor: { id: "owner-1", email: "owner@example.com" },
    });

    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "owner-1",
        action: "finance.expense.create",
        entityId: "expense-1",
      }),
    });
  });

  it("reporta e propaga falha de persistência", async () => {
    const failure = new Error("database unavailable");
    mocks.create.mockRejectedValue(failure);

    await expect(logAudit({ action: "stock.adjust" })).rejects.toBe(failure);
    expect(mocks.reportError).toHaveBeenCalledWith(failure, {
      operation: "audit.write",
      action: "stock.adjust",
    });
  });

  it("reporta e propaga falha ao resolver o ator", async () => {
    const failure = new Error("session unavailable");
    mocks.getCurrentUser.mockRejectedValue(failure);

    await expect(logAudit({ action: "team.update" })).rejects.toBe(failure);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.reportError).toHaveBeenCalledWith(failure, {
      operation: "audit.write",
      action: "team.update",
    });
  });
});
