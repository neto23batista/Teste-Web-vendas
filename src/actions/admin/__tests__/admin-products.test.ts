import { beforeEach, describe, expect, it, vi } from "vitest";

const productFindUnique = vi.fn();
const productUpdate = vi.fn();
const auditInTransaction = vi.fn();

// A mutação e a auditoria compartilham a transação: o mock precisa oferecer
// as duas pontas para que o teste exercite o caminho real.
const tx = { product: { update: (...a: unknown[]) => productUpdate(...a) } };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: (...args: unknown[]) => productFindUnique(...args),
      update: (...args: unknown[]) => productUpdate(...args),
    },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));
vi.mock("@/lib/auth/session", () => ({
  requireAdmin: async () => ({ pharmacyType: "MATRIZ", staffProfile: "OWNER" }),
  assertArea: vi.fn(),
  requireAdminAtPharmacy: vi.fn(),
}));
vi.mock("@/lib/auth/permissions", () => ({ canAccess: () => true }));
vi.mock("@/lib/audit", () => ({
  logAuditInTransaction: (...args: unknown[]) => auditInTransaction(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { toggleProductActive } from "@/actions/admin/products";

beforeEach(() => {
  vi.clearAllMocks();
  productUpdate.mockResolvedValue({});
});

describe("ativação de produto no admin", () => {
  it("impede ativar produto sujeito a prescrição", async () => {
    productFindUnique.mockResolvedValue({
      id: "rx-1",
      name: "Produto RX",
      active: false,
      requiresPrescription: true,
    });

    const result = await toggleProductActive("rx-1");

    expect(result.ok).toBe(false);
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it("mantém o toggle para produto MIP", async () => {
    productFindUnique.mockResolvedValue({
      id: "mip-1",
      name: "Produto MIP",
      active: false,
      requiresPrescription: false,
    });

    const result = await toggleProductActive("mip-1");

    expect(result.ok).toBe(true);
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: "mip-1" },
      data: { active: true },
    });
    // A evidência sai na MESMA transação da mudança.
    expect(auditInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "product.toggle" }),
    );
  });
});
