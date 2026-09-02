import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  assertArea: vi.fn(),
  requireAdminAtPharmacy: vi.fn(),
  transaction: vi.fn(),
  lockOrder: vi.fn(),
  orderFindFirst: vi.fn(),
  priorItems: vi.fn(),
  createRequest: vi.fn(),
  findRequest: vi.fn(),
  updateRequest: vi.fn(),
  updateItem: vi.fn(),
  changeInventory: vi.fn(),
  settleRefund: vi.fn(),
  audit: vi.fn(),
  reportError: vi.fn(),
  revalidateTag: vi.fn(),
}));

const delegates = {
  order: { findFirst: mocks.orderFindFirst },
  returnRequest: {
    create: mocks.createRequest,
    findUnique: mocks.findRequest,
    updateMany: mocks.updateRequest,
  },
  returnItem: { groupBy: mocks.priorItems, update: mocks.updateItem },
};
const tx = { ...delegates, $queryRaw: mocks.lockOrder };

vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  order: { findFirst: mocks.orderFindFirst },
  returnRequest: { create: mocks.createRequest, findUnique: mocks.findRequest, updateMany: mocks.updateRequest },
  returnItem: { groupBy: mocks.priorItems, update: mocks.updateItem },
} }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: mocks.requireUser,
  assertArea: mocks.assertArea,
  requireAdminAtPharmacy: mocks.requireAdminAtPharmacy,
}));
vi.mock("@/lib/inventory/movements", () => ({ changeInventory: mocks.changeInventory }));
vi.mock("@/lib/payments/return-refunds", () => ({ settleReturnRefund: mocks.settleRefund }));
vi.mock("@/lib/audit", () => ({ logAuditInTransaction: mocks.audit }));
vi.mock("@/lib/monitoring", () => ({ reportError: mocks.reportError }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: mocks.revalidateTag }));

import { decideReturnRequest, receiveReturnRequest, requestReturn } from "@/actions/account/returns";

const order = {
  id: "order-1", status: "DELIVERED", pharmacyId: "pharmacy-1",
  deliveredAt: new Date("2026-09-01T18:00:00.000Z"),
  items: [{ id: "item-1", qty: 2, price: "15.00" }],
};
const requestInput = {
  orderId: "order-1", reason: "DAMAGED" as const,
  items: [{ orderItemId: "item-1", qty: 1 }],
};
const approvedRequest = {
  id: "return-1", orderId: "order-1", pharmacyId: "pharmacy-1",
  status: "APPROVED", requestedAmount: "15.00", adminNotes: null,
  items: [{ id: "return-item-1", qty: 1, orderItem: { productId: "product-1", name: "Produto" } }],
};
const receiptInput = {
  returnId: "return-1", restock: [{ returnItemId: "return-item-1", qty: 1 }],
};

describe("devoluções por item", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T18:00:00.000Z"));
    mocks.requireUser.mockResolvedValue({ id: "customer-1" });
    mocks.requireAdminAtPharmacy.mockResolvedValue({ id: "staff-1", email: "staff@example.test" });
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    mocks.lockOrder.mockResolvedValue([{ id: "order-1" }]);
    mocks.orderFindFirst.mockResolvedValue(order);
    mocks.priorItems.mockResolvedValue([]);
    mocks.createRequest.mockResolvedValue({ id: "return-1" });
    mocks.findRequest.mockResolvedValue(approvedRequest);
    mocks.updateRequest.mockResolvedValue({ count: 1 });
    mocks.settleRefund.mockResolvedValue({ ok: true });
  });

  afterEach(() => vi.useRealTimers());

  it.each([1.5, -0.5, NaN, Infinity, "1", null])("recusa quantidade não inteira: %s", async (qty) => {
    expect((await requestReturn({ ...requestInput, items: [{ orderItemId: "item-1", qty: qty as number }] })).ok).toBe(false);
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("recusa itens repetidos em vez de substituir silenciosamente a quantidade", async () => {
    const result = await requestReturn({ ...requestInput, items: [requestInput.items[0], requestInput.items[0]] });
    expect(result.ok).toBe(false);
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("trava somente o pedido do usuário e calcula o saldo dentro da transação", async () => {
    expect(await requestReturn(requestInput)).toEqual({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.lockOrder).toHaveBeenCalledOnce();
    expect(mocks.lockOrder.mock.calls[0].slice(1)).toEqual(["order-1", "customer-1"]);
    expect(mocks.lockOrder.mock.invocationCallOrder[0]).toBeLessThan(mocks.priorItems.mock.invocationCallOrder[0]);
    expect(mocks.createRequest).toHaveBeenCalledWith({ data: expect.objectContaining({
      orderId: "order-1", userId: "customer-1", pharmacyId: "pharmacy-1",
      requestedAmount: "15.00", items: { create: [{ orderItemId: "item-1", qty: 1 }] },
    }) });
  });

  it("não consulta itens de pedido de outra pessoa nem de pedido arquivado", async () => {
    mocks.lockOrder.mockResolvedValue([]);
    const result = await requestReturn(requestInput);
    expect(result.ok).toBe(false);
    expect(mocks.priorItems).not.toHaveBeenCalled();
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("considera as quantidades de devoluções anteriores", async () => {
    mocks.priorItems.mockResolvedValue([{ orderItemId: "item-1", _sum: { qty: 2 } }]);
    const result = await requestReturn(requestInput);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/saldo devolvível/) });
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("recusa item que não pertence ao pedido", async () => {
    const result = await requestReturn({ ...requestInput, items: [{ orderItemId: "another-item", qty: 1 }] });
    expect(result.ok).toBe(false);
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("também recusa item de outro pedido quando sua quantidade é zero", async () => {
    const result = await requestReturn({ ...requestInput, items: [...requestInput.items, { orderItemId: "another-item", qty: 0 }] });
    expect(result.ok).toBe(false);
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("mantém a resposta controlada para a restrição de uma devolução ativa", async () => {
    mocks.createRequest.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }));
    expect(await requestReturn(requestInput)).toEqual({ ok: false, error: expect.stringMatching(/em andamento/) });
  });

  it("não aceita nova solicitação depois do prazo operacional", async () => {
    mocks.orderFindFirst.mockResolvedValue({ ...order, deliveredAt: new Date("2026-08-01T12:00:00.000Z") });
    expect((await requestReturn(requestInput)).ok).toBe(false);
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("não transforma falha concorrente de aprovação em erro não tratado", async () => {
    mocks.findRequest.mockResolvedValue({ ...approvedRequest, status: "REQUESTED" });
    mocks.updateRequest.mockResolvedValue({ count: 0 });
    await expect(decideReturnRequest({ returnId: "return-1", approve: true })).resolves.toEqual({ ok: false, error: expect.stringMatching(/analisada/) });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each([1.5, -0.5, NaN, "1"])("recusa reposição não inteira: %s", async (qty) => {
    const result = await receiveReturnRequest({ ...receiptInput, restock: [{ returnItemId: "return-item-1", qty: qty as number }] });
    expect(result.ok).toBe(false);
    expect(mocks.changeInventory).not.toHaveBeenCalled();
    expect(mocks.settleRefund).not.toHaveBeenCalled();
  });

  it("recusa reposição com item de outra solicitação, inclusive quantidade zero", async () => {
    const result = await receiveReturnRequest({ ...receiptInput, restock: [{ returnItemId: "another-return-item", qty: 0 }] });
    expect(result.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.settleRefund).not.toHaveBeenCalled();
  });

  it("recusa itens repetidos no recebimento", async () => {
    const result = await receiveReturnRequest({ ...receiptInput, restock: [receiptInput.restock[0], receiptInput.restock[0]] });
    expect(result.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("recusa recebimento fora da unidade autorizada", async () => {
    mocks.requireAdminAtPharmacy.mockRejectedValue(new Error("Acesso negado"));
    await expect(receiveReturnRequest(receiptInput)).rejects.toThrow("Acesso negado");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("não repõe novamente quando outra operação já recebeu a devolução", async () => {
    mocks.updateRequest.mockResolvedValue({ count: 0 });
    expect((await receiveReturnRequest(receiptInput)).ok).toBe(false);
    expect(mocks.changeInventory).not.toHaveBeenCalled();
    expect(mocks.settleRefund).not.toHaveBeenCalled();
  });

  it("recebe, audita e invalida também o estoque mostrado na loja", async () => {
    expect(await receiveReturnRequest(receiptInput)).toEqual({ ok: true });
    expect(mocks.changeInventory).toHaveBeenCalledWith(tx, expect.objectContaining({
      productId: "product-1", pharmacyId: "pharmacy-1", delta: 1, kind: "RETURN",
    }));
    expect(mocks.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "return.receive" }));
    expect(mocks.revalidateTag).toHaveBeenCalledWith("products", "max");
  });

  it("preserva o sucesso do recebimento físico se a liquidação ficar indisponível", async () => {
    mocks.settleRefund.mockRejectedValue(new Error("provider-offline"));
    await expect(receiveReturnRequest(receiptInput)).resolves.toEqual({ ok: true, warning: expect.stringMatching(/recebidos/) });
    expect(mocks.changeInventory).toHaveBeenCalledOnce();
    expect(mocks.reportError).toHaveBeenCalledOnce();
  });
});
