import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertArea: vi.fn(),
  assertOwner: vi.fn(),
  requireAdminAtPharmacy: vi.fn(),
  pharmacyUpdate: vi.fn(),
  exportFindUnique: vi.fn(),
  exportUpdate: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({
  assertArea: mocks.assertArea,
  assertOwner: mocks.assertOwner,
  requireAdminAtPharmacy: mocks.requireAdminAtPharmacy,
}));
vi.mock("@/lib/integration-auth", () => ({
  newIntegrationToken: () => ({ token: "raw-token", hash: "token-hash" }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pharmacy: { update: mocks.pharmacyUpdate },
    orderExport: {
      findUnique: mocks.exportFindUnique,
      update: mocks.exportUpdate,
    },
  },
}));

import {
  generateIntegrationToken,
  retryOrderExport,
} from "@/actions/integration";

describe("autorização das ações de integração", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertArea.mockResolvedValue({ id: "actor" });
    mocks.assertOwner.mockResolvedValue({ id: "actor" });
    mocks.requireAdminAtPharmacy.mockResolvedValue({ id: "actor" });
    mocks.audit.mockResolvedValue(undefined);
  });

  it("reserva a rotação do token a OWNER", async () => {
    mocks.assertOwner.mockRejectedValue(new Error("forbidden"));

    await expect(generateIntegrationToken("ph-1")).resolves.toEqual({
      ok: false,
      error: "Sem permissão para esta unidade.",
    });
    expect(mocks.requireAdminAtPharmacy).not.toHaveBeenCalled();
    expect(mocks.pharmacyUpdate).not.toHaveBeenCalled();
  });

  it("também confere o escopo da unidade ao rotacionar o token", async () => {
    mocks.requireAdminAtPharmacy.mockRejectedValue(new Error("other unit"));

    await expect(generateIntegrationToken("ph-2")).resolves.toEqual({
      ok: false,
      error: "Sem permissão para esta unidade.",
    });
    expect(mocks.assertOwner).toHaveBeenCalledOnce();
    expect(mocks.pharmacyUpdate).not.toHaveBeenCalled();
  });

  it("confere a área antes de revelar se uma exportação existe", async () => {
    mocks.assertArea.mockRejectedValue(new Error("forbidden"));

    await expect(retryOrderExport("exp-1")).resolves.toEqual({
      ok: false,
      error: "Sem permissão para esta ação.",
    });
    expect(mocks.exportFindUnique).not.toHaveBeenCalled();
  });
});
