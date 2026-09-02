import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  redirect: vi.fn(),
}));

// Fora do renderer do React queremos uma chamada nova em cada asserção.
vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.userFindUnique } },
}));

import {
  assertArea,
  assertOwner,
  getCurrentUser,
  requireAdmin,
  requireAdminAtPharmacy,
  requireUserPage,
} from "@/lib/auth/session";

const staleOwnerSession = {
  user: {
    id: "user-1",
    name: "Dono",
    email: "dono@exemplo.com",
    role: "ADMIN",
    staffProfile: "OWNER",
    pharmacyId: "ph-antiga",
    pharmacyType: "MATRIZ",
    sessionVersion: 7,
    mfaEnabled: true,
  },
};

function currentAdmin(overrides: Record<string, unknown> = {}) {
  return {
    role: "ADMIN",
    staffProfile: "OWNER",
    pharmacyId: "ph-atual",
    sessionVersion: 7,
    mfaEnabledAt: new Date("2026-08-22T00:00:00Z"),
    pharmacy: { type: "MATRIZ", active: true },
    ...overrides,
  };
}

describe("guards administrativos com revalidação no banco", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.auth.mockResolvedValue(staleOwnerSession);
    mocks.userFindUnique.mockResolvedValue(currentAdmin());
  });

  it("invalida o JWT quando a versão persistida mudou", async () => {
    mocks.userFindUnique.mockResolvedValue(
      currentAdmin({ sessionVersion: 8 })
    );
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("redireciona página com sessão revogada preservando callback interno", async () => {
    mocks.userFindUnique.mockResolvedValue(currentAdmin({ sessionVersion: 8 }));
    mocks.redirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      requireUserPage("/checkout?cupom=BEMVINDO")
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?callbackUrl=%2Fcheckout%3Fcupom%3DBEMVINDO"
    );
  });

  it("não permite callback externo no redirect de página", async () => {
    mocks.auth.mockResolvedValue(null);
    mocks.redirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireUserPage("//evil.test/roubo")).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?callbackUrl=%2Fconta"
    );
  });

  it("exige MFA administrativo somente na loja pública", async () => {
    vi.stubEnv("APP_ENV", "production");
    mocks.userFindUnique.mockResolvedValue(
      currentAdmin({ mfaEnabledAt: null })
    );
    await expect(requireAdmin()).rejects.toThrow("Acesso negado");
  });

  it("nega imediatamente um ADMIN revogado apesar do JWT antigo", async () => {
    mocks.userFindUnique.mockResolvedValue(currentAdmin({ role: "CUSTOMER" }));
    await expect(requireAdmin()).rejects.toThrow("Acesso negado");
  });

  it("nega conta sem unidade ativa", async () => {
    mocks.userFindUnique.mockResolvedValue(
      currentAdmin({ pharmacy: { type: "MATRIZ", active: false } })
    );
    await expect(requireAdmin()).rejects.toThrow("Acesso negado");
  });

  it("usa o perfil atual e não o OWNER obsoleto do JWT", async () => {
    mocks.userFindUnique.mockResolvedValue(
      currentAdmin({ staffProfile: "ATTENDANT" })
    );
    await expect(assertOwner()).rejects.toThrow("Apenas o dono/gerente");
    await expect(assertArea("equipe")).rejects.toThrow(
      "Seu perfil não permite esta ação."
    );
  });

  it("usa a unidade atual ao conferir o escopo", async () => {
    mocks.userFindUnique.mockResolvedValue(
      currentAdmin({
        pharmacyId: "ph-atual",
        pharmacy: { type: "FILIAL", active: true },
      })
    );
    await expect(requireAdminAtPharmacy("ph-antiga")).rejects.toThrow(
      "Acesso negado a esta unidade"
    );
    await expect(requireAdminAtPharmacy("ph-atual")).resolves.toMatchObject({
      pharmacyId: "ph-atual",
      pharmacyType: "FILIAL",
    });
  });

  it("nega a uma filial registros legados sem unidade", async () => {
    mocks.userFindUnique.mockResolvedValue(
      currentAdmin({
        pharmacyId: "ph-atual",
        pharmacy: { type: "FILIAL", active: true },
      })
    );

    await expect(requireAdminAtPharmacy(null)).rejects.toThrow(
      "Acesso negado a esta unidade"
    );
  });

  it("permite que a matriz saneie registros legados sem unidade", async () => {
    await expect(requireAdminAtPharmacy(null)).resolves.toMatchObject({
      pharmacyType: "MATRIZ",
    });
  });
});
