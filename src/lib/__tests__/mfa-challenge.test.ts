import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recoveryUpdateMany: vi.fn(),
  userUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mfaRecoveryCode: { updateMany: mocks.recoveryUpdateMany },
    user: { updateMany: mocks.userUpdateMany },
  },
}));

import { decryptMfaSecret, encryptMfaSecret, generateTotp } from "@/lib/mfa";
import { verifyMfaChallenge } from "@/lib/mfa-challenge";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MFA_ENCRYPTION_KEY", "enc-A1!secret-B2@value-C3#with-D4$enough-E5%entropy");
  vi.stubEnv("MFA_RECOVERY_PEPPER", "pep-Z9!secret-Y8@value-X7#with-W6$enough-V5%entropy");
  mocks.userUpdateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => vi.unstubAllEnvs());

function identity(secret = "JBSWY3DPEHPK3PXP") {
  return {
    id: "admin-1",
    mfaEnabledAt: new Date(),
    mfaSecretEncrypted: encryptMfaSecret(secret),
  };
}

describe("desafio MFA", () => {
  it("aceita um TOTP sem consultar códigos de recuperação", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const code = generateTotp(secret);

    await expect(verifyMfaChallenge(identity(secret), code)).resolves.toBe(true);
    expect(mocks.recoveryUpdateMany).not.toHaveBeenCalled();
  });

  it("reivindica o recovery code de forma atômica e de uso único", async () => {
    mocks.recoveryUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      verifyMfaChallenge(identity(), "ABCD-EFGH-IJKL-MNOP")
    ).resolves.toBe(true);
    await expect(
      verifyMfaChallenge(identity(), "ABCD-EFGH-IJKL-MNOP")
    ).resolves.toBe(false);

    expect(mocks.recoveryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "admin-1",
          usedAt: null,
        }),
      })
    );
  });

  it("reenvelopa o segredo após TOTP válido com a chave anterior", async () => {
    const oldKey = "old-enc-A1!secret-B2@value-C3#with-D4$enough-E5%entropy";
    const newKey = "new-enc-Z9!secret-Y8@value-X7#with-W6$enough-V5%entropy";
    const secret = "JBSWY3DPEHPK3PXP";
    vi.stubEnv("MFA_ENCRYPTION_KEY", oldKey);
    const encryptedWithOldKey = encryptMfaSecret(secret);
    vi.stubEnv("MFA_ENCRYPTION_KEY", newKey);
    vi.stubEnv("MFA_ENCRYPTION_KEY_PREVIOUS", oldKey);

    await expect(
      verifyMfaChallenge(
        {
          id: "admin-1",
          mfaEnabledAt: new Date(),
          mfaSecretEncrypted: encryptedWithOldKey,
        },
        generateTotp(secret)
      )
    ).resolves.toBe(true);

    const rewrapped = mocks.userUpdateMany.mock.calls[0][0].data
      .mfaSecretEncrypted as string;
    vi.stubEnv("MFA_ENCRYPTION_KEY_PREVIOUS", "");
    expect(decryptMfaSecret(rewrapped)).toBe(secret);
  });

  it("falha fechado sem MFA ativo ou com segredo adulterado", async () => {
    await expect(
      verifyMfaChallenge(
        { id: "admin-1", mfaEnabledAt: null, mfaSecretEncrypted: null },
        "123456"
      )
    ).resolves.toBe(false);
    await expect(
      verifyMfaChallenge(
        { id: "admin-1", mfaEnabledAt: new Date(), mfaSecretEncrypted: "v1.invalido" },
        "123456"
      )
    ).resolves.toBe(false);
    expect(mocks.recoveryUpdateMany).not.toHaveBeenCalled();
  });
});
