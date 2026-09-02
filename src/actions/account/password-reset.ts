"use server";

import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import {
  resetRequestSchema,
  resetPasswordSchema,
} from "@/lib/auth/validators";
import { sendMail, baseUrl } from "@/lib/communications/mail";
import { passwordResetEmail } from "@/lib/communications/email-templates";
import { hashPassword } from "@/lib/auth/password";

export type ResetState = { ok?: boolean; error?: string } | undefined;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Solicita o reset: gera um token de uso único (guardamos só o hash), envia o
 * link por e-mail e SEMPRE responde de forma genérica — não revela se o e-mail
 * existe (anti-enumeração).
 */
export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe um e-mail válido." };

  const ip = await clientIp();
  if (!(await rateLimit(`pwreset:${ip}`, 5, 60_000)).ok) {
    return { error: "Muitas tentativas. Aguarde um instante e tente de novo." };
  }

  const email = parsed.data.email.toLowerCase();
  const emailKey = hashToken(email).slice(0, 32);
  if (!(await rateLimit(`pwreset:email:${emailKey}`, 3, 15 * 60_000)).ok) {
    // Resposta deliberadamente igual à de sucesso: não confirma existência e
    // impede disparos repetidos para a mesma caixa por IPs diferentes.
    return { ok: true };
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (user) {
    const raw = randomBytes(32).toString("hex");
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Invalida tokens anteriores ainda ativos do usuário (1 link válido por vez).
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const url = `${baseUrl()}/redefinir-senha?token=${raw}`;
    const mail = passwordResetEmail(user.name, url);
    await sendMail({ to: email, subject: mail.subject, html: mail.html });
  }

  return { ok: true };
}

/** Confirma o reset: valida o token (não usado e não expirado) e troca a senha. */
export async function resetPassword(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const tokenHash = hashToken(parsed.data.token);
  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();
  const changed = await prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });
    if (!record) return false;

    // Claim condicional: duas requisições concorrentes não podem reutilizar o token.
    const claim = await tx.passwordResetToken.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claim.count !== 1) return false;

    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    return true;
  });
  if (!changed) {
    return { error: "Link inválido ou expirado. Solicite um novo." };
  }

  return { ok: true };
}
