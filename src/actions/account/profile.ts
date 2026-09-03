"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export type ProfileState = { error?: string; success?: boolean } | undefined;

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const cpf = onlyDigits(String(formData.get("cpf") ?? ""));
  const phone = onlyDigits(String(formData.get("phone") ?? ""));

  if (name.length < 3 || name.length > 120) {
    return { error: "Informe seu nome completo." };
  }
  if (cpf && !isValidCpf(cpf)) return { error: "Informe um CPF válido." };
  if (phone && !/^\d{10,11}$/.test(phone)) {
    return { error: "Informe um telefone com DDD válido." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { name, cpf: cpf || null, phone: phone || null },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Este CPF já está vinculado a outra conta." };
    }
    throw error;
  }

  // Só a página de perfil precisa revalidar (a saudação do layout vem da sessão,
  // não muda aqui) — evita re-render desnecessário do dashboard a cada salvar.
  revalidatePath("/conta/perfil");
  return { success: true };
}

export async function changePassword(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();

  // Anti brute-force da senha atual (mesma janela do login).
  const ip = await clientIp();
  if (!(await rateLimit(`chpass:${ip}:${user.id}`, 5, 60_000, { critical: true })).ok) {
    return { error: "Muitas tentativas. Aguarde um instante e tente novamente." };
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 12 || next.length > 64) {
    return { error: "A nova senha precisa ter entre 12 e 64 caracteres." };
  }
  if (next !== confirm) return { error: "As senhas não conferem." };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) return { error: "Usuário não encontrado." };

  const ok = await verifyPassword(current, dbUser.passwordHash);
  if (!ok) return { error: "Senha atual incorreta." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(next),
      sessionVersion: { increment: 1 },
    },
  });
  return { success: true };
}
