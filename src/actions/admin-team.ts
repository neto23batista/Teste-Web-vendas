"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { StaffProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertArea, getAdminScope } from "@/lib/session";
import { isOwnerProfile } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const PROFILES: StaffProfile[] = ["OWNER", "PHARMACIST", "STOCKIST", "ATTENDANT"];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export type TeamResult = { ok: boolean; error?: string; password?: string };

/** Cria um membro da equipe (role ADMIN + perfil). Senha temporária gerada. */
export async function createStaff(formData: FormData): Promise<TeamResult> {
  await assertArea("equipe");
  const scope = await getAdminScope();

  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const profile = str(formData, "staffProfile") as StaffProfile;
  // Escopo de unidade: só a MATRIZ pode escolher a unidade e criar DONO (OWNER).
  // Um admin de filial não pode escalar — o novo membro fica preso à unidade dele
  // e não pode ser OWNER (que teria acesso global). Sem isso, uma filial criava
  // um dono global e pegava a senha temporária no retorno.
  const pharmacyId = scope.isGlobal
    ? str(formData, "pharmacyId") || null
    : scope.pharmacyId;
  if (!scope.isGlobal && profile === "OWNER") {
    return { ok: false, error: "Sua unidade não pode criar um Dono / Gerente." };
  }

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
  const scope = await getAdminScope();
  if (!PROFILES.includes(profile)) return { ok: false, error: "Perfil inválido." };
  if (userId === actor.id && profile !== "OWNER") {
    return { ok: false, error: "Você não pode rebaixar o próprio acesso." };
  }
  // Filial não promove a DONO (acesso global).
  if (!scope.isGlobal && profile === "OWNER") {
    return { ok: false, error: "Sua unidade não pode definir um Dono / Gerente." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, staffProfile: true, pharmacyId: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Membro não encontrado." };
  }
  // Filial só mexe em membros da própria unidade.
  if (!scope.isGlobal && target.pharmacyId !== scope.pharmacyId) {
    return { ok: false, error: "Este membro é de outra unidade." };
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
  const scope = await getAdminScope();
  if (userId === actor.id) {
    return { ok: false, error: "Você não pode remover o próprio acesso." };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, staffProfile: true, pharmacyId: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Membro não encontrado." };
  }
  // Filial só mexe em membros da própria unidade.
  if (!scope.isGlobal && target.pharmacyId !== scope.pharmacyId) {
    return { ok: false, error: "Este membro é de outra unidade." };
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
