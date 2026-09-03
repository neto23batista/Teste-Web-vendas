import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exportFindMany: vi.fn(),
  exportUpdate: vi.fn(),
  orderFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  reportError: vi.fn(),
  // As demais coleções não têm papel neste teste: devolvem vazio.
  empty: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dataExportRequest: {
      findMany: mocks.exportFindMany,
      update: mocks.exportUpdate,
    },
    order: { findMany: mocks.orderFindMany },
    auditLog: { findMany: mocks.auditFindMany },
    user: mocks.empty,
    address: mocks.empty,
    loyaltyAccount: mocks.empty,
    review: mocks.empty,
    favorite: mocks.empty,
    subscription: mocks.empty,
    cart: mocks.empty,
    policyAcceptance: mocks.empty,
    prescription: mocks.empty,
  },
}));
vi.mock("@/lib/storage", () => ({
  putObject: mocks.putObject,
  deleteObject: mocks.deleteObject,
}));
vi.mock("@/lib/monitoring", () => ({ reportError: mocks.reportError }));

import {
  buildDataExportPayload,
  processDataExports,
} from "@/lib/privacy/data-export";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.empty.findUnique.mockResolvedValue(null);
  mocks.empty.findFirst.mockResolvedValue(null);
  mocks.empty.findMany.mockResolvedValue([]);
  mocks.orderFindMany.mockResolvedValue([]);
  mocks.auditFindMany.mockResolvedValue([]);
  mocks.exportFindMany.mockResolvedValue([]);
  mocks.exportUpdate.mockResolvedValue({});
});

describe("montagem da exportação", () => {
  it("pagina o histórico em vez de puxar tudo de uma vez", async () => {
    // Primeira página cheia (200) força a busca da próxima; a segunda encerra.
    const page = (from: number, size: number) =>
      Array.from({ length: size }, (_, index) => ({
        id: `order-${from + index}`,
        number: `FV${from + index}`,
        subtotal: 10,
        discount: 0,
        shipping: 0,
        total: 10,
        payment: null,
        items: [],
      }));
    mocks.orderFindMany
      .mockResolvedValueOnce(page(0, 200))
      .mockResolvedValueOnce(page(200, 5));

    const payload = await buildDataExportPayload("user-1");

    expect(mocks.orderFindMany).toHaveBeenCalledTimes(2);
    // A segunda página continua de onde a primeira parou.
    expect(mocks.orderFindMany.mock.calls[1]![0]).toMatchObject({
      cursor: { id: "order-199" },
      skip: 1,
    });
    expect(payload.pedidos).toHaveLength(205);
    // O id serve só para paginar: não é dado do titular.
    expect(payload.pedidos[0]).not.toHaveProperty("id");
  });
});

describe("ciclo de vida do arquivo", () => {
  it("gera, guarda em storage privado e marca prazo de validade", async () => {
    mocks.exportFindMany
      .mockResolvedValueOnce([{ id: "exp-1", userId: "user-1" }])
      .mockResolvedValueOnce([]);

    const run = await processDataExports(5);

    expect(run.processed).toBe(1);
    const [key, body] = mocks.putObject.mock.calls[0]!;
    expect(key).toBe("exports/user-1/exp-1.json");
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(mocks.exportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exp-1" },
        data: expect.objectContaining({
          status: "READY",
          storageKey: "exports/user-1/exp-1.json",
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it("falha de geração vira estado explícito, não silêncio", async () => {
    mocks.exportFindMany
      .mockResolvedValueOnce([{ id: "exp-1", userId: "user-1" }])
      .mockResolvedValueOnce([]);
    mocks.putObject.mockRejectedValue(new Error("storage fora do ar"));

    const run = await processDataExports(5);

    expect(run.failed).toBe(1);
    expect(mocks.reportError).toHaveBeenCalledOnce();
    expect(mocks.exportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("apaga o arquivo vencido do storage — temporário não vira cópia permanente", async () => {
    mocks.exportFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "exp-velho", storageKey: "exports/user-1/exp-velho.json" }]);

    const run = await processDataExports(5);

    expect(run.expired).toBe(1);
    expect(mocks.deleteObject).toHaveBeenCalledWith("exports/user-1/exp-velho.json");
    expect(mocks.exportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "EXPIRED", storageKey: null },
      }),
    );
  });
});
