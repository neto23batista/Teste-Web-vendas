"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import type { StaffProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertArea, getAdminScope } from "@/lib/auth/session";
import { isOwnerProfile } from "@/lib/auth/permissions";
import { logAuditInTransaction } from "@/lib/audit";
import { baseUrl, sendMail } from "@/lib/communications/mail";
import { staffInviteEmail } from "@/lib/communications/email-templates";
import { hashPassword } from "@/lib/auth/password";

const PROFILES: StaffProfile[] = ["OWNER", "PHARMACIST", "STOCKIST", "ATTENDANT"];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export type TeamResult = { ok: boolean; error?: string; setupUrl?: string };

/** Cria um membro e envia um link de uso único para definir a senha. */
export async function createStaff(formData: FormData): Promise<TeamResult> {
  const actor = await assertArea("equipe");
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

  // A conta nasce com uma senha criptograficamente aleatória que nunca é
  // exibida. O membro define a senha por um token de uso único e curta duração.
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const initialPassword = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const passwordHash = await hashPassword(initialPassword);

  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        staffProfile: profile,
        pharmacyId,
      },
      select: { id: true },
    });
    await tx.passwordResetToken.create({
      data: { userId: created.id, tokenHash, expiresAt },
    });
    await logAuditInTransaction(tx, {
      action: "team.create",
      entity: "User",
      entityId: created.id,
      detail: `Criou membro administrativo com perfil ${profile}`,
      pharmacyId,
      actor: { id: actor.id, email: actor.email ?? null },
    });
  });

  const setupUrl = `${baseUrl()}/redefinir-senha?token=${rawToken}`;
  const invitation = staffInviteEmail(name, setupUrl);
  const delivered = await sendMail({
    to: email,
    subject: invitation.subject,
    html: invitation.html,
  });

  revalidatePath("/admin/equipe");
  // Se o provedor de e-mail estiver ausente/indisponível, o OWNER ainda pode
  // entregar manualmente o link. Ele expira em 1h e deixa de valer após o uso.
  return { ok: true, setupUrl: delivered ? undefined : setupUrl };
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
    select: { role: true, staffProfile: true, pharmacyId: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Membro não encontrado." };
  }
  // Filial só mexe em membros da própria unidade.
  if (!scope.isGlobal && target.pharmacyId !== scope.pharmacyId) {
    return { ok: false, error: "Este membro é de outra unidade." };
  }

  // Nunca deixar o sistema sem dono. OWNER precisa ser explícito.
  if (profile !== "OWNER") {
    const owners = await prisma.user.count({
      where: { role: "ADMIN", staffProfile: "OWNER" },
    });
    if (isOwnerProfile(target.staffProfile) && owners <= 1) {
      return { ok: false, error: "É preciso manter ao menos um Dono / Gerente." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { staffProfile: profile, sessionVersion: { increment: 1 } },
    });
    await logAuditInTransaction(tx, {
      action: "team.profile",
      entity: "User",
      entityId: userId,
      detail: `Alterou o perfil administrativo para ${profile}`,
      pharmacyId: target.pharmacyId,
      actor: { id: actor.id, email: actor.email ?? null },
    });
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
    select: { role: true, staffProfile: true, pharmacyId: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Membro não encontrado." };
  }
  // Filial só mexe em membros da própria unidade.
  if (!scope.isGlobal && target.pharmacyId !== scope.pharmacyId) {
    return { ok: false, error: "Este membro é de outra unidade." };
  }
  const owners = await prisma.user.count({
    where: { role: "ADMIN", staffProfile: "OWNER" },
  });
  if (isOwnerProfile(target.staffProfile) && owners <= 1) {
    return { ok: false, error: "É preciso manter ao menos um Dono / Gerente." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        role: "CUSTOMER",
        staffProfile: null,
        pharmacyId: null,
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        sessionVersion: { increment: 1 },
      },
    });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await logAuditInTransaction(tx, {
      action: "team.revoke",
      entity: "User",
      entityId: userId,
      detail: "Revogou o acesso administrativo",
      pharmacyId: target.pharmacyId,
      actor: { id: actor.id, email: actor.email ?? null },
    });
  });
  revalidatePath("/admin/equipe");
  return { ok: true };
}
