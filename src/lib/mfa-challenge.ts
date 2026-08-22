import { prisma } from "@/lib/prisma";
import {
  decryptMfaSecretWithRotation,
  encryptMfaSecret,
  normalizeRecoveryCode,
  recoveryCodeHashCandidates,
  verifyTotp,
} from "@/lib/mfa";

type MfaIdentity = {
  id: string;
  mfaEnabledAt: Date | null;
  mfaSecretEncrypted: string | null;
};

/**
 * Confere o segundo fator de uma conta com MFA ativo.
 *
 * Códigos TOTP ficam válidos apenas na janela curta definida em `verifyTotp`.
 * Códigos de recuperação são comparados por HMAC e reivindicados com um
 * UPDATE condicional: duas requisições concorrentes nunca usam o mesmo código.
 */
export async function verifyMfaChallenge(
  user: MfaIdentity,
  rawCode: string
): Promise<boolean> {
  if (!user.mfaEnabledAt || !user.mfaSecretEncrypted) return false;

  const code = rawCode.trim();
  let decrypted: ReturnType<typeof decryptMfaSecretWithRotation> | null = null;
  try {
    decrypted = decryptMfaSecretWithRotation(user.mfaSecretEncrypted);
    if (verifyTotp(decrypted.secret, code)) {
      if (decrypted.usedPreviousKey) {
        await prisma.user
          .updateMany({
            where: { id: user.id, mfaSecretEncrypted: user.mfaSecretEncrypted },
            data: { mfaSecretEncrypted: encryptMfaSecret(decrypted.secret) },
          })
          .catch(() => undefined);
      }
      return true;
    }
  } catch {
    // Um recovery code válido ainda pode resgatar o acesso ao autenticador.
  }

  const normalized = normalizeRecoveryCode(code);
  if (!/^[A-Z0-9]{16}$/.test(normalized)) return false;

  const claimed = await prisma.mfaRecoveryCode.updateMany({
    where: {
      userId: user.id,
      codeHash: { in: recoveryCodeHashCandidates(normalized) },
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return false;
  if (decrypted?.usedPreviousKey) {
    await prisma.user
      .updateMany({
        where: { id: user.id, mfaSecretEncrypted: user.mfaSecretEncrypted },
        data: { mfaSecretEncrypted: encryptMfaSecret(decrypted.secret) },
      })
      .catch(() => undefined);
  }
  return true;
}
