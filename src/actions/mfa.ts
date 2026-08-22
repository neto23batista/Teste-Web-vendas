"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  mfaOtpAuthUri,
  verifyTotp,
} from "@/lib/mfa";
import { verifyMfaChallenge } from "@/lib/mfa-challenge";
import { qrPngBase64 } from "@/lib/qrcode";
import { isLiveProduction } from "@/lib/env";
import { logAudit } from "@/lib/audit";

export type MfaBeginState =
  | { error?: string; secret?: string; qrDataUrl?: string }
  | undefined;

export type MfaConfirmState =
  | { error?: string; recoveryCodes?: string[] }
  | undefined;

export type MfaDisableState =
  | { error?: string; success?: boolean }
  | undefined;

const TOO_MANY = "Muitas tentativas. Aguarde um instante e tente novamente.";

/** Reautentica o administrador e prepara um segredo ainda não ativo. */
export async function beginMfaSetup(
  _previous: MfaBeginState,
  formData: FormData
): Promise<MfaBeginState> {
  const session = await requireUser();
  const password = String(formData.get("currentPassword") ?? "");
  if (!password || password.length > 128) return { error: "Senha atual incorreta." };

  const ip = await clientIp();
  if (!(await rateLimit(`mfa:begin:${ip}:${session.id}`, 5, 15 * 60_000)).ok) {
    return { error: TOO_MANY };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      role: true,
      email: true,
      passwordHash: true,
      mfaEnabledAt: true,
    },
  });
  if (!user || user.role !== "ADMIN") {
    return { error: "O MFA desta tela é destinado a contas administrativas." };
  }
  if (user.mfaEnabledAt) return { error: "O MFA já está ativo nesta conta." };
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: "Senha atual incorreta." };
  }

  const secret = generateMfaSecret();
  const uri = mfaOtpAuthUri(user.email, secret);
  const qr = await qrPngBase64(uri);
  await prisma.user.update({
    where: { id: session.id },
    data: {
      mfaSecretEncrypted: encryptMfaSecret(secret),
      mfaEnabledAt: null,
    },
  });

  return {
    secret,
    qrDataUrl: qr ? `data:image/png;base64,${qr}` : undefined,
  };
}

/** Confirma o TOTP e mostra os recovery codes em claro uma única vez. */
export async function confirmMfaSetup(
  _previous: MfaConfirmState,
  formData: FormData
): Promise<MfaConfirmState> {
  const session = await requireUser();
  const code = String(formData.get("mfaCode") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "Informe o código de 6 dígitos." };

  const ip = await clientIp();
  if (!(await rateLimit(`mfa:confirm:${ip}:${session.id}`, 8, 15 * 60_000)).ok) {
    return { error: TOO_MANY };
  }

  const current = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      role: true,
      mfaSecretEncrypted: true,
      mfaEnabledAt: true,
    },
  });
  if (
    !current ||
    current.role !== "ADMIN" ||
    !current.mfaSecretEncrypted ||
    current.mfaEnabledAt
  ) {
    return { error: "Inicie novamente a configuração do MFA." };
  }

  let secret: string;
  try {
    secret = decryptMfaSecret(current.mfaSecretEncrypted);
  } catch {
    return { error: "Inicie novamente a configuração do MFA." };
  }
  if (!verifyTotp(secret, code)) return { error: "Código inválido ou expirado." };

  const recoveryCodes = generateRecoveryCodes();
  const activatedAt = new Date();
  const activated = await prisma.$transaction(async (tx) => {
    const claim = await tx.user.updateMany({
      where: {
        id: session.id,
        role: "ADMIN",
        mfaEnabledAt: null,
        mfaSecretEncrypted: current.mfaSecretEncrypted,
      },
      data: {
        mfaEnabledAt: activatedAt,
        sessionVersion: { increment: 1 },
      },
    });
    if (claim.count !== 1) return false;

    await tx.mfaRecoveryCode.deleteMany({ where: { userId: session.id } });
    await tx.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({
        userId: session.id,
        codeHash: hashRecoveryCode(recoveryCode),
      })),
    });
    return true;
  });
  if (!activated) return { error: "A configuração mudou. Comece novamente." };

  await logAudit({
    action: "security.mfa.enable",
    entity: "User",
    entityId: session.id,
    detail: "Ativou autenticação multifator",
    pharmacyId: session.pharmacyId,
    // A ativação acabou de revogar a versão do cookie atual. Preserve o ator
    // capturado antes da mutação em vez de depender de reler essa sessão.
    actor: { id: session.id, email: session.email ?? null },
  });
  return { recoveryCodes };
}

/** Desativa MFA apenas fora da loja pública, sempre com senha + segundo fator. */
export async function disableMfa(
  _previous: MfaDisableState,
  formData: FormData
): Promise<MfaDisableState> {
  const session = await requireUser();
  if (isLiveProduction()) {
    return { error: "O MFA é obrigatório para administradores em produção." };
  }

  const password = String(formData.get("currentPassword") ?? "");
  const code = String(formData.get("mfaCode") ?? "").trim();
  if (!password || password.length > 128 || !code || code.length > 64) {
    return { error: "Informe a senha atual e o segundo fator." };
  }

  const ip = await clientIp();
  if (!(await rateLimit(`mfa:disable:${ip}:${session.id}`, 5, 15 * 60_000)).ok) {
    return { error: TOO_MANY };
  }

  const current = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      mfaSecretEncrypted: true,
      mfaEnabledAt: true,
    },
  });
  if (
    !current ||
    current.role !== "ADMIN" ||
    !(await verifyPassword(password, current.passwordHash)) ||
    !(await verifyMfaChallenge(current, code))
  ) {
    return { error: "Senha ou segundo fator incorreto." };
  }

  const disabled = await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: session.id, role: "ADMIN", mfaEnabledAt: { not: null } },
      data: {
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        sessionVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1) return false;
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: session.id } });
    return true;
  });
  if (!disabled) return { error: "O MFA já estava desativado." };

  await logAudit({
    action: "security.mfa.disable",
    entity: "User",
    entityId: session.id,
    detail: "Desativou autenticação multifator fora de produção",
    pharmacyId: session.pharmacyId,
    actor: { id: session.id, email: session.email ?? null },
  });
  return { success: true };
}
