"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type ProfileState = { error?: string; success?: boolean } | undefined;

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 3) return { error: "Informe seu nome completo." };

  await prisma.user.update({
    where: { id: user.id },
    data: { name, cpf: cpf || null, phone: phone || null },
  });

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
  if (!(await rateLimit(`chpass:${ip}:${user.id}`, 5, 60_000)).ok) {
    return { error: "Muitas tentativas. Aguarde um instante e tente novamente." };
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8) {
    return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  }
  if (next !== confirm) return { error: "As senhas não conferem." };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) return { error: "Usuário não encontrado." };

  const ok = await bcrypt.compare(current, dbUser.passwordHash);
  if (!ok) return { error: "Senha atual incorreta." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  return { success: true };
}
