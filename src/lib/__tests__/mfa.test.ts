import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  generateRecoveryCodes,
  generateTotp,
  hashRecoveryCode,
  mfaOtpAuthUri,
  normalizeRecoveryCode,
  recoveryCodeHashCandidates,
  verifyTotp,
} from "@/lib/mfa";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MFA_ENCRYPTION_KEY", "enc-A1!secret-B2@value-C3#with-D4$enough-E5%entropy");
  vi.stubEnv("MFA_RECOVERY_PEPPER", "pep-Z9!secret-Y8@value-X7#with-W6$enough-V5%entropy");
});

afterEach(() => vi.unstubAllEnvs());

describe("MFA", () => {
  it("cifra com nonce aleatório e recupera o segredo", () => {
    const secret = generateMfaSecret();
    const first = encryptMfaSecret(secret);
    const second = encryptMfaSecret(secret);
    expect(first).not.toBe(second);
    expect(decryptMfaSecret(first)).toBe(secret);
  });

  it("segue o vetor RFC 6238 e aceita somente a janela curta", () => {
    // Segredo ASCII "12345678901234567890" e instante 59 s do vetor oficial.
    // O RFC usa 8 dígitos (94287082); para o perfil de 6 dígitos o resultado
    // esperado são os seis dígitos menos significativos.
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const at = 59_000;
    const validCode = generateTotp(secret, at);
    expect(validCode).toBe("287082");
    expect(validCode).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, validCode, at + 29_000)).toBe(true);
    expect(verifyTotp(secret, validCode, at + 120_000)).toBe(false);
    expect(verifyTotp(secret, "abc", at)).toBe(false);
  });

  it("gera URI e códigos de recuperação que só precisam do hash", () => {
    const uri = mfaOtpAuthUri("owner@example.com", "ABCDEF234567");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABCDEF234567");

    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(normalizeRecoveryCode(codes[0])).toHaveLength(16);
    expect(hashRecoveryCode(codes[0])).toHaveLength(64);
    expect(hashRecoveryCode(codes[0])).toBe(
      hashRecoveryCode(codes[0].toLowerCase().replaceAll("-", " "))
    );
  });

  it("falha se a cifra for adulterada", () => {
    const encrypted = encryptMfaSecret(generateMfaSecret());
    const parts = encrypted.split(".");
    // Troca bits efetivos do ciphertext. Alterar só o último caractere base64url
    // pode produzir os mesmos bytes quando ele contém apenas bits de padding.
    parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
    expect(() => decryptMfaSecret(parts.join("."))).toThrow();
  });

  it("aceita chave e pepper anteriores durante rotação gradual", () => {
    const oldEncryption = "old-enc-A1!secret-B2@value-C3#with-D4$enough-E5%entropy";
    const newEncryption = "new-enc-Z9!secret-Y8@value-X7#with-W6$enough-V5%entropy";
    const oldPepper = "old-pep-Q1!secret-W2@value-E3#with-R4$enough-T5%entropy";
    const newPepper = "new-pep-P9!secret-O8@value-I7#with-U6$enough-Y5%entropy";

    vi.stubEnv("MFA_ENCRYPTION_KEY", oldEncryption);
    vi.stubEnv("MFA_RECOVERY_PEPPER", oldPepper);
    const encrypted = encryptMfaSecret("ABCDEF234567");
    const oldRecoveryHash = hashRecoveryCode("ABCD-EFGH-IJKL-MNOP");

    vi.stubEnv("MFA_ENCRYPTION_KEY", newEncryption);
    vi.stubEnv("MFA_ENCRYPTION_KEY_PREVIOUS", oldEncryption);
    vi.stubEnv("MFA_RECOVERY_PEPPER", newPepper);
    vi.stubEnv("MFA_RECOVERY_PEPPER_PREVIOUS", oldPepper);

    expect(decryptMfaSecret(encrypted)).toBe("ABCDEF234567");
    expect(recoveryCodeHashCandidates("ABCD-EFGH-IJKL-MNOP")).toContain(
      oldRecoveryHash
    );
    expect(hashRecoveryCode("ABCD-EFGH-IJKL-MNOP")).not.toBe(oldRecoveryHash);
  });
});
