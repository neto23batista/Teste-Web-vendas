import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertArea: vi.fn(),
  getAdminScope: vi.fn(),
  userFindMany: vi.fn(),
  userFindFirst: vi.fn(),
  userCount: vi.fn(),
  orderAggregate: vi.fn(),
  orderCount: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  productCount: vi.fn(),
  inventoryCount: vi.fn(),
  reviewFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  assertArea: mocks.assertArea,
  getAdminScope: mocks.getAdminScope,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: mocks.userFindMany,
      findFirst: mocks.userFindFirst,
      count: mocks.userCount,
    },
    order: {
      aggregate: mocks.orderAggregate,
      count: mocks.orderCount,
      findMany: mocks.orderFindMany,
      findUnique: mocks.orderFindUnique,
    },
    product: { count: mocks.productCount },
    inventory: {
      count: mocks.inventoryCount,
      fields: { minStock: "minStock-field-reference" },
    },
    review: { findMany: mocks.reviewFindMany },
  },
}));

import {
  getAdminCustomer,
  getAdminCustomers,
  getAdminOrder,
  getAdminStats,
  getReviewsByApproval,
} from "@/lib/admin";

describe("escopo de clientes por filial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertArea.mockResolvedValue(undefined);
    mocks.getAdminScope.mockResolvedValue({
      isGlobal: false,
      pharmacyId: "filial-1",
    });
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userCount.mockResolvedValue(0);
  });

  it("lista somente clientes com pedido na filial e conta apenas esses pedidos", async () => {
    await getAdminCustomers("ana", 2);

    expect(mocks.assertArea).toHaveBeenCalledWith("clientes");
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "CUSTOMER",
          orders: { some: { pharmacyId: "filial-1" } },
        }),
        select: expect.objectContaining({
          _count: {
            select: {
              orders: { where: { pharmacyId: "filial-1" } },
            },
          },
        }),
      })
    );
    expect(mocks.userFindMany.mock.calls[0][0].select).not.toHaveProperty("cpf");
    expect(mocks.userCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        orders: { some: { pharmacyId: "filial-1" } },
      }),
    });
  });

  it("mantém a listagem e a contagem globais para a matriz", async () => {
    mocks.getAdminScope.mockResolvedValue({
      isGlobal: true,
      pharmacyId: "matriz-1",
    });

    await getAdminCustomers();

    const args = mocks.userFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ role: "CUSTOMER" });
    expect(args.select._count.select.orders).toBe(true);
  });

  it("nega IDOR e limita pedidos e endereços do detalhe à filial", async () => {
    await getAdminCustomer("cliente-externo");

    expect(mocks.userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "cliente-externo",
          role: "CUSTOMER",
          orders: { some: { pharmacyId: "filial-1" } },
        },
        select: expect.objectContaining({
          addresses: {
            where: {
              orders: { some: { pharmacyId: "filial-1" } },
            },
            orderBy: { isDefault: "desc" },
          },
          orders: expect.objectContaining({
            where: { pharmacyId: "filial-1" },
          }),
        }),
      })
    );
  });

  it("mantém todos os pedidos e endereços no detalhe da matriz", async () => {
    mocks.getAdminScope.mockResolvedValue({
      isGlobal: true,
      pharmacyId: "matriz-1",
    });

    await getAdminCustomer("cliente-1");

    const args = mocks.userFindFirst.mock.calls[0][0];
    expect(args.where).toEqual({ id: "cliente-1", role: "CUSTOMER" });
    expect(args.select.orders).not.toHaveProperty("where");
    expect(args.select.addresses).not.toHaveProperty("where");
  });

  it("não entrega pedido legado sem unidade a uma filial", async () => {
    mocks.orderFindUnique.mockResolvedValue({
      id: "pedido-legado",
      pharmacyId: null,
    });

    await expect(getAdminOrder("pedido-legado")).resolves.toBeNull();
  });

  it("permite que a matriz consulte pedido legado sem unidade", async () => {
    mocks.getAdminScope.mockResolvedValue({
      isGlobal: true,
      pharmacyId: "matriz-1",
    });
    const legacy = {
      id: "pedido-legado",
      pharmacyId: null,
      subtotal: 0,
      discount: 0,
      shipping: 0,
      total: 0,
      items: [],
      returnRequests: [],
      payment: null,
    };
    mocks.orderFindUnique.mockResolvedValue(legacy);

    await expect(getAdminOrder("pedido-legado")).resolves.toEqual(legacy);
  });
});

describe("minimização de PII e métricas administrativas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertArea.mockResolvedValue(undefined);
    mocks.getAdminScope.mockResolvedValue({
      isGlobal: false,
      pharmacyId: "filial-1",
    });
    mocks.orderAggregate.mockResolvedValue({ _sum: { total: null } });
    mocks.orderCount.mockResolvedValue(0);
    mocks.orderFindMany.mockResolvedValue([]);
    mocks.userCount.mockResolvedValue(0);
    mocks.productCount.mockResolvedValue(0);
    mocks.inventoryCount.mockResolvedValue(0);
    mocks.reviewFindMany.mockResolvedValue([]);
  });

  it("calcula clientes do dashboard somente dentro da filial", async () => {
    await getAdminStats();

    expect(mocks.userCount).toHaveBeenCalledTimes(3);
    for (const [args] of mocks.userCount.mock.calls) {
      expect(args.where).toMatchObject({
        role: "CUSTOMER",
        orders: { some: { pharmacyId: "filial-1" } },
      });
    }
  });

  it("não consulta o e-mail do autor ao moderar avaliações", async () => {
    await getReviewsByApproval(false);

    expect(mocks.assertArea).toHaveBeenCalledWith("avaliacoes");
    expect(mocks.reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          user: { select: { name: true } },
        }),
      })
    );
  });
});
