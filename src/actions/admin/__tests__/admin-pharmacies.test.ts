import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOwner: vi.fn(),
  getCurrentUser: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  pharmacyFindFirst: vi.fn(),
  pharmacyUpdate: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  assertOwner: mocks.assertOwner,
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/lib/pharmacy", () => ({ cepToInt: vi.fn() }));
vi.mock("@/lib/utils", () => ({ slugify: (value: string) => value.toLowerCase() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
    pharmacy: {
      findUnique: vi.fn(),
      findFirst: mocks.pharmacyFindFirst,
      create: vi.fn(),
      update: mocks.pharmacyUpdate,
      delete: vi.fn(),
    },
    pharmacyCepRange: { create: vi.fn(), delete: vi.fn() },
  },
}));

import { assignUnitAdmin, setPharmacyActive } from "@/actions/admin/pharmacies";

describe("autorização das mutações globais de unidades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.audit.mockResolvedValue(undefined);
    mocks.userUpdate.mockResolvedValue({});
    mocks.pharmacyFindFirst.mockResolvedValue({ id: "ph-1" });
  });

  it("nega staff que não é OWNER antes de acessar o banco", async () => {
    mocks.assertOwner.mockRejectedValue(new Error("forbidden"));

    await expect(setPharmacyActive("ph-1", true)).resolves.toEqual({
      ok: false,
      error: "Sem permissão.",
    });
    expect(mocks.pharmacyUpdate).not.toHaveBeenCalled();
  });

  it("nega OWNER de filial em mutação global", async () => {
    mocks.assertOwner.mockResolvedValue({ pharmacyType: "FILIAL" });

    await expect(assignUnitAdmin("pessoa@exemplo.com", "ph-1")).resolves.toEqual({
      ok: false,
      error: "Sem permissão.",
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("atribui o menor perfil explícito ao promover um cliente", async () => {
    mocks.assertOwner.mockResolvedValue({ pharmacyType: "MATRIZ" });
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      role: "CUSTOMER",
      staffProfile: null,
    });

    await expect(assignUnitAdmin("Pessoa@Exemplo.com", "ph-1")).resolves.toEqual({
      ok: true,
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        role: "ADMIN",
        staffProfile: "ATTENDANT",
        pharmacyId: "ph-1",
        sessionVersion: { increment: 1 },
      },
    });
  });
});
