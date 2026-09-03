import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertArea: vi.fn(), requireAdminAtPharmacy: vi.fn(), orderFindUnique: vi.fn(),
  courierFindUnique: vi.fn(), markOrderDelivered: vi.fn(), transitionOrderStatus: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ assertArea: mocks.assertArea, assertOwner: vi.fn(), requireAdminAtPharmacy: mocks.requireAdminAtPharmacy }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  order: { findUnique: mocks.orderFindUnique }, courier: { findUnique: mocks.courierFindUnique },
} }));
vi.mock("@/lib/orders", () => ({
  ORDER_STATUSES: ["PENDING", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELED"],
  markOrderDelivered: mocks.markOrderDelivered, transitionOrderStatus: mocks.transitionOrderStatus,
  isValidOrderTransition: () => true, cancelOrder: vi.fn(), fulfillOrder: vi.fn(), transferOrder: vi.fn(), processOrderRefund: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/lib/communications/mail", () => ({ sendMail: vi.fn(), baseUrl: () => "http://localhost" }));
vi.mock("@/lib/communications/notifications", () => ({ notifyUnit: vi.fn() }));
vi.mock("@/lib/communications/email-templates", () => ({ orderStatusEmail: vi.fn(), orderIncomingTransferEmail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateOrderStatus } from "@/actions/admin/orders";
import { dispatchOrder, markDelivered } from "@/actions/admin/deliveries";

const proof = { method: "RECIPIENT" as const, recipientName: "Maria Silva", recipientDocumentLast4: "1234" };

describe("entrega com entregador e comprovante obrigatórios", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.assertArea.mockResolvedValue({ id: "staff-1", email: "staff@example.test" });
    mocks.requireAdminAtPharmacy.mockResolvedValue({ id: "staff-1" });
    mocks.orderFindUnique.mockResolvedValue({ number: "FV-1", pharmacyId: "unit-a", status: "SHIPPED", courier: { name: "Entregador" } });
    mocks.courierFindUnique.mockResolvedValue({ name: "Entregador", pharmacyId: "unit-a", active: true });
    mocks.markOrderDelivered.mockResolvedValue(true);
    mocks.transitionOrderStatus.mockResolvedValue(true);
  });

  it("não contorna a prova de entrega pelo seletor genérico de status", async () => {
    const result = await updateOrderStatus("order-1", "DELIVERED");
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/Entregas/) });
    expect(mocks.markOrderDelivered).not.toHaveBeenCalled();
  });

  it("não permite despachar pelo seletor genérico sem atribuir entregador", async () => {
    mocks.orderFindUnique.mockResolvedValue({ number: "FV-1", pharmacyId: "unit-a", status: "PREPARING" });
    expect((await updateOrderStatus("order-1", "SHIPPED")).ok).toBe(false);
    expect(mocks.transitionOrderStatus).not.toHaveBeenCalled();
  });

  it("registra quem recebeu e quem confirmou na unidade autorizada", async () => {
    expect(await markDelivered("order-1", proof)).toEqual({ ok: true });
    expect(mocks.assertArea).toHaveBeenCalledWith("entregas");
    expect(mocks.requireAdminAtPharmacy).toHaveBeenCalledWith("unit-a");
    expect(mocks.markOrderDelivered).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        ...proof, courierName: "Entregador", confirmedById: "staff-1", confirmedByEmail: "staff@example.test",
      }),
      // A trilha de auditoria vai junto, para ser gravada no MESMO commit da
      // entrega — e não numa escrita solta que pode falhar depois.
      expect.objectContaining({
        action: "delivery.done",
        entityId: "order-1",
        actor: { id: "staff-1", email: "staff@example.test" },
      }),
    );
  });

  it("recusa documento completo em vez de armazená-lo no comprovante", async () => {
    expect((await markDelivered("order-1", { ...proof, recipientDocumentLast4: "12345678901" })).ok).toBe(false);
    expect(mocks.markOrderDelivered).not.toHaveBeenCalled();
  });

  it("recusa comprovante sem destinatário", async () => {
    expect((await markDelivered("order-1", { ...proof, recipientName: " " })).ok).toBe(false);
    expect(mocks.markOrderDelivered).not.toHaveBeenCalled();
  });

  it("não confirma entrega em outra unidade", async () => {
    mocks.requireAdminAtPharmacy.mockRejectedValue(new Error("Acesso negado"));
    await expect(markDelivered("order-1", proof)).rejects.toThrow("Acesso negado");
    expect(mocks.markOrderDelivered).not.toHaveBeenCalled();
  });

  it("não registra sucesso quando outra operação mudou o pedido", async () => {
    mocks.markOrderDelivered.mockResolvedValue(false);
    expect((await markDelivered("order-1", proof)).ok).toBe(false);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("exige entregador da mesma unidade no despacho", async () => {
    mocks.orderFindUnique.mockResolvedValue({ number: "FV-1", pharmacyId: "unit-a", status: "PREPARING" });
    mocks.courierFindUnique.mockResolvedValue({ name: "Entregador", pharmacyId: "unit-b", active: true });
    expect((await dispatchOrder("order-1", "courier-1")).ok).toBe(false);
    expect(mocks.transitionOrderStatus).not.toHaveBeenCalled();
  });
});
