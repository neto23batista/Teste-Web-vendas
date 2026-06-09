"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

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
