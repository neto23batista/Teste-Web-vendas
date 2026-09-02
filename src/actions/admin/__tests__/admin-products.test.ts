import { beforeEach, describe, expect, it, vi } from "vitest";

const productFindUnique = vi.fn();
const productUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: (...args: unknown[]) => productFindUnique(...args),
      update: (...args: unknown[]) => productUpdate(...args),
    },
  },
}));
vi.mock("@/lib/auth/session", () => ({
  requireAdmin: async () => ({ pharmacyType: "MATRIZ", staffProfile: "OWNER" }),
  assertArea: vi.fn(),
  requireAdminAtPharmacy: vi.fn(),
}));
vi.mock("@/lib/auth/permissions", () => ({ canAccess: () => true }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
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
  });
});
