"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { StaffProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertArea } from "@/lib/session";
import { isOwnerProfile } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const PROFILES: StaffProfile[] = ["OWNER", "PHARMACIST", "STOCKIST", "ATTENDANT"];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export type TeamResult = { ok: boolean; error?: string; password?: string };

/** Cria um membro da equipe (role ADMIN + perfil). Senha temporária gerada. */
export async function createStaff(formData: FormData): Promise<TeamResult> {
  await assertArea("equipe");

  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const profile = str(formData, "staffProfile") as StaffProfile;
  const pharmacyId = str(formData, "pharmacyId") || null;

  if (name.length < 3) return { ok: false, error: "Informe o nome completo." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "E-mail inválido." };
  }
  if (!PROFILES.includes(profile)) return { ok: false, error: "Perfil inválido." };

  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: "Já existe uma conta com este e-mail." };
  }

  // Senha temporária: o membro troca no primeiro acesso ("Esqueci minha senha").
  const password = `Farma@${Math.random().toString(36).slice(2, 10)}`;
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      staffProfile: profile,
      pharmacyId,
    },
  });

  await logAudit({
    action: "team.create",
    entity: "User",
    detail: `Membro ${email} criado com perfil ${profile}`,
    pharmacyId,
  });
  revalidatePath("/admin/equipe");
  return { ok: true, password };
}

/** Troca o perfil de um membro. Impede a conta ficar sem nenhum OWNER. */
export async function updateStaffProfile(
  userId: string,
  profile: StaffProfile
): Promise<{ ok: boolean; error?: string }> {
  const actor = await assertArea("equipe");
  if (!PROFILES.includes(profile)) return { ok: false, error: "Perfil inválido." };
  if (userId === actor.id && profile !== "OWNER") {
    return { ok: false, error: "Você não pode rebaixar o próprio acesso." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, staffProfile: true, pharmacyId: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Membro não encontrado." };
  }

  // Nunca deixar o sistema sem dono: staffProfile null (legado) conta como OWNER.
  if (profile !== "OWNER") {
    const owners = await prisma.user.count({
      where: { role: "ADMIN", OR: [{ staffProfile: "OWNER" }, { staffProfile: null }] },
    });
    if (isOwnerProfile(target.staffProfile) && owners <= 1) {
      return { ok: false, error: "É preciso manter ao menos um Dono / Gerente." };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { staffProfile: profile } });
  await logAudit({
    action: "team.profile",
    entity: "User",
    entityId: userId,
    detail: `Perfil de ${target.email} alterado para ${profile}`,
    pharmacyId: target.pharmacyId,
  });
  revalidatePath("/admin/equipe");
  return { ok: true };
}

/** Remove o acesso ao painel (vira cliente comum). Não apaga a conta. */
export async function revokeStaff(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const actor = await assertArea("equipe");
  if (userId === actor.id) {
    return { ok: false, error: "Você não pode remover o próprio acesso." };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, staffProfile: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Membro não encontrado." };
  }
  const owners = await prisma.user.count({
    where: { role: "ADMIN", OR: [{ staffProfile: "OWNER" }, { staffProfile: null }] },
  });
  if (isOwnerProfile(target.staffProfile) && owners <= 1) {
    return { ok: false, error: "É preciso manter ao menos um Dono / Gerente." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: "CUSTOMER", staffProfile: null, pharmacyId: null },
  });
  await logAudit({
    action: "team.revoke",
    entity: "User",
    entityId: userId,
    detail: `Acesso ao painel removido de ${target.email}`,
  });
  revalidatePath("/admin/equipe");
  return { ok: true };
}
