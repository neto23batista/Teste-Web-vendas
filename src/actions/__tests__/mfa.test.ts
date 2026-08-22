import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  txUserUpdateMany: vi.fn(),
  recoveryDeleteMany: vi.fn(),
  recoveryCreateMany: vi.fn(),
  rateLimit: vi.fn(),
  verifyPassword: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
    pharmacyId: "ph-1",
  }),
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    user: { updateMany: mocks.txUserUpdateMany },
    mfaRecoveryCode: {
      deleteMany: mocks.recoveryDeleteMany,
      createMany: mocks.recoveryCreateMany,
    },
  };
  return {
    prisma: {
      user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    },
  };
});
vi.mock("@/lib/rate-limit", () => ({
  clientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/password", () => ({
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/lib/qrcode", () => ({ qrPngBase64: vi.fn().mockResolvedValue("cXI=") }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/lib/mfa-challenge", () => ({ verifyMfaChallenge: vi.fn() }));

import { beginMfaSetup, confirmMfaSetup, disableMfa } from "@/actions/mfa";
import { decryptMfaSecret, encryptMfaSecret, generateTotp } from "@/lib/mfa";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv(
    "AUTH_SECRET",
    "test-A1!secret-B2@value-C3#with-D4$enough-E5%entropy"
  );
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MFA_ENCRYPTION_KEY", "enc-A1!secret-B2@value-C3#with-D4$enough-E5%entropy");
  vi.stubEnv("MFA_RECOVERY_PEPPER", "pep-Z9!secret-Y8@value-X7#with-W6$enough-V5%entropy");
  mocks.rateLimit.mockResolvedValue({ ok: true, remaining: 4, resetAt: Date.now() });
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.userUpdate.mockResolvedValue({});
  mocks.txUserUpdateMany.mockResolvedValue({ count: 1 });
  mocks.recoveryDeleteMany.mockResolvedValue({ count: 0 });
  mocks.recoveryCreateMany.mockResolvedValue({ count: 10 });
  mocks.audit.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

describe("configuração do MFA", () => {
  it("só prepara o segredo depois de reautenticar e o persiste cifrado", async () => {
    mocks.userFindUnique.mockResolvedValue({
      role: "ADMIN",
      email: "admin@example.com",
      passwordHash: "hash",
      mfaEnabledAt: null,
    });
    const form = new FormData();
    form.set("currentPassword", "senha-atual");

    const result = await beginMfaSetup(undefined, form);

    expect(result?.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result?.qrDataUrl).toBe("data:image/png;base64,cXI=");
    const encrypted = mocks.userUpdate.mock.calls[0][0].data.mfaSecretEncrypted;
    expect(encrypted).not.toContain(result?.secret);
    expect(decryptMfaSecret(encrypted)).toBe(result?.secret);
  });

  it("ativa atomicamente, incrementa a sessão e guarda apenas hashes dos recovery codes", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptMfaSecret(secret);
    mocks.userFindUnique.mockResolvedValue({
      role: "ADMIN",
      mfaSecretEncrypted: encrypted,
      mfaEnabledAt: null,
    });
    const form = new FormData();
    form.set("mfaCode", generateTotp(secret));

    const result = await confirmMfaSetup(undefined, form);

    expect(result?.recoveryCodes).toHaveLength(10);
    expect(mocks.txUserUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionVersion: { increment: 1 } }),
      })
    );
    const stored = mocks.recoveryCreateMany.mock.calls[0][0].data;
    expect(stored).toHaveLength(10);
    expect(stored.every((row: { codeHash: string }) => /^[a-f0-9]{64}$/.test(row.codeHash))).toBe(
      true
    );
    for (const raw of result?.recoveryCodes ?? []) {
      expect(JSON.stringify(stored)).not.toContain(raw);
    }
  });

  it("não permite desativar MFA na loja pública", async () => {
    vi.stubEnv("APP_ENV", "production");
    const form = new FormData();
    await expect(disableMfa(undefined, form)).resolves.toEqual({
      error: "O MFA é obrigatório para administradores em produção.",
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });
});
