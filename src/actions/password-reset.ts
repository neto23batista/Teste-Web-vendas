"use server";

import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  resetRequestSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth";
import { sendMail, baseUrl } from "@/lib/mail";
import { passwordResetEmail } from "@/lib/email-templates";

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
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Link inválido ou expirado. Solicite um novo." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
