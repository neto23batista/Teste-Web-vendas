import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  assertOwner: vi.fn(),
  requireAdminAtPharmacy: vi.fn(),
  prescriptionFindUnique: vi.fn(),
  getObject: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: mocks.requireUser,
  assertOwner: mocks.assertOwner,
  requireAdminAtPharmacy: mocks.requireAdminAtPharmacy,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    prescription: { findUnique: mocks.prescriptionFindUnique },
  },
}));
vi.mock("@/lib/storage", () => ({ getObject: mocks.getObject }));
vi.mock("@/lib/storage/uploads", () => ({
  CONTENT_TYPE_BY_EXT: { ".pdf": "application/pdf" },
}));

import { GET } from "@/app/api/prescriptions/[id]/route";

const context = { params: Promise.resolve({ id: "rx-1" }) };

describe("autorização do histórico de receitas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "patient-1" });
    mocks.assertOwner.mockResolvedValue({ id: "owner-1" });
    mocks.requireAdminAtPharmacy.mockResolvedValue({ id: "owner-1" });
    mocks.getObject.mockResolvedValue(Buffer.from("pdf"));
  });

  it("nega a um owner o documento atendido por outra unidade", async () => {
    mocks.prescriptionFindUnique.mockResolvedValue({
      userId: "patient-2",
      fileUrl: "private/rx.pdf",
      order: { pharmacyId: "filial-externa" },
    });
    mocks.requireAdminAtPharmacy.mockRejectedValue(new Error("forbidden"));

    const response = await GET(new Request("http://localhost/api/prescriptions/rx-1"), context);

    expect(response.status).toBe(403);
    expect(mocks.requireAdminAtPharmacy).toHaveBeenCalledWith("filial-externa");
    expect(mocks.getObject).not.toHaveBeenCalled();
  });

  it("mantém o acesso do paciente ao próprio documento", async () => {
    mocks.prescriptionFindUnique.mockResolvedValue({
      userId: "patient-1",
      fileUrl: "private/rx.pdf",
      order: { pharmacyId: "filial-externa" },
    });

    const response = await GET(new Request("http://localhost/api/prescriptions/rx-1"), context);

    expect(response.status).toBe(200);
    expect(mocks.assertOwner).not.toHaveBeenCalled();
    expect(mocks.requireAdminAtPharmacy).not.toHaveBeenCalled();
  });
});
