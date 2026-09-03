import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertArea: vi.fn(),
  getAdminScope: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userCount: vi.fn(),
  queryRaw: vi.fn(),
  recoveryDeleteMany: vi.fn(),
}));

const tx = {
  user: { update: mocks.userUpdate, count: mocks.userCount },
  mfaRecoveryCode: { deleteMany: mocks.recoveryDeleteMany },
  auditLog: { create: vi.fn() },
  $queryRaw: mocks.queryRaw,
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  assertArea: mocks.assertArea,
  getAdminScope: mocks.getAdminScope,
}));
vi.mock("@/lib/audit", () => ({ logAuditInTransaction: vi.fn() }));
vi.mock("@/lib/communications/mail", () => ({
  baseUrl: () => "http://localhost",
  sendMail: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

import { revokeStaff, updateStaffProfile } from "@/actions/admin/team";

const owner = {
  role: "ADMIN",
  staffProfile: "OWNER",
  pharmacyId: "matriz",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertArea.mockResolvedValue({ id: "actor", email: "actor@fv.test" });
  mocks.getAdminScope.mockResolvedValue({ isGlobal: true, pharmacyId: null });
  mocks.userFindUnique.mockResolvedValue(owner);
  mocks.userUpdate.mockResolvedValue({});
  mocks.recoveryDeleteMany.mockResolvedValue({ count: 0 });
  mocks.queryRaw.mockResolvedValue([]);
});

describe("nunca deixar o painel sem Dono / Gerente", () => {
  it("rebaixar o último dono é recusado e nada é gravado", async () => {
    mocks.userCount.mockResolvedValue(0); // nenhum outro OWNER sobra

    const result = await updateStaffProfile("u1", "ATTENDANT");

    expect(result).toMatchObject({ ok: false });
    expect(result.error).toMatch(/ao menos um Dono/i);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("revogar o último dono é recusado e nada é gravado", async () => {
    mocks.userCount.mockResolvedValue(0);

    const result = await revokeStaff("u1");

    expect(result).toMatchObject({ ok: false });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.recoveryDeleteMany).not.toHaveBeenCalled();
  });

  it("a contagem roda DENTRO da transação e atrás do lock", async () => {
    mocks.userCount.mockResolvedValue(1);

    await updateStaffProfile("u1", "ATTENDANT");

    // O advisory lock é o que serializa dois rebaixamentos simultâneos: sem ele
    // os dois leem o mesmo total e os dois passam.
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    // E a contagem precisa excluir quem está perdendo o perfil agora.
    expect(mocks.userCount).toHaveBeenCalledWith({
      where: {
        role: "ADMIN",
        staffProfile: "OWNER",
        id: { not: "u1" },
      },
    });
    expect(mocks.userUpdate).toHaveBeenCalled();
  });

  it("promover a dono não precisa de checagem — só some dono, nunca aparece", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...owner, staffProfile: "ATTENDANT" });

    await updateStaffProfile("u1", "OWNER");

    expect(mocks.userCount).not.toHaveBeenCalled();
    expect(mocks.userUpdate).toHaveBeenCalled();
  });

  it("rebaixar quem não é dono não mexe na contagem", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...owner, staffProfile: "STOCKIST" });

    await updateStaffProfile("u1", "ATTENDANT");

    expect(mocks.userCount).not.toHaveBeenCalled();
    expect(mocks.userUpdate).toHaveBeenCalled();
  });
});
