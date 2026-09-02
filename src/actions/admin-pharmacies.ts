"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertOwner } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { cepToInt } from "@/lib/pharmacy";
import { slugify } from "@/lib/utils";
import { Prisma, type PharmacyType } from "@prisma/client";
import { centsToDecimal, parseMoneyInputToCents } from "@/lib/money";

export type PharmacyResult = { ok: boolean; error?: string };

// Somente um OWNER vinculado à matriz pode executar mutações globais.
// Server Actions são endpoints: a autorização precisa viver em cada Action.
async function ensureGlobalOwner() {
  try {
    const actor = await assertOwner();
    return actor.pharmacyType === "MATRIZ" ? actor : null;
  } catch {
    return null;
  }
}

function revalidatePharmacies() {
  revalidateTag("pharmacies", "max");
  revalidatePath("/admin/configuracoes");
  revalidatePath("/", "layout");
}

async function uniquePharmacySlug(base: string): Promise<string> {
  let slug = slugify(base) || "unidade";
  let i = 1;
  while (await prisma.pharmacy.findUnique({ where: { slug } })) {
    slug = `${slugify(base) || "unidade"}-${i++}`;
  }
  return slug;
}

export async function createPharmacy(data: {
  name: string;
  type: PharmacyType;
  city?: string;
  state?: string;
  phone?: string;
}): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  const name = data.name.trim();
  if (!name) return { ok: false, error: "Informe o nome da unidade." };
  if (data.type === "MATRIZ") {
    const exists = await prisma.pharmacy.findFirst({
      where: { type: "MATRIZ", archivedAt: null },
    });
    if (exists) return { ok: false, error: "Já existe uma matriz; cadastre como filial." };
  }
  let created;
  try {
    created = await prisma.pharmacy.create({
      data: {
        name,
        slug: await uniquePharmacySlug(name),
        type: data.type,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        phone: data.phone?.trim() || null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error:
          data.type === "MATRIZ"
            ? "Já existe uma matriz; cadastre como filial."
            : "Outra unidade acabou de usar este identificador. Tente novamente.",
      };
    }
    throw error;
  }
  await logAudit({
    action: "pharmacy.create",
    entity: "Pharmacy",
    entityId: created.id,
    detail: `Cadastrou a unidade "${name}" (${data.type})`,
    pharmacyId: created.id,
  });
  revalidatePharmacies();
  return { ok: true };
}

export async function setPharmacyActive(
  id: string,
  active: boolean
): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  const ph = await prisma.pharmacy.findUnique({
    where: { id },
    select: { type: true, archivedAt: true },
  });
  if (!ph || ph.archivedAt) {
    return { ok: false, error: "Unidade não encontrada ou arquivada." };
  }
  if (ph?.type === "MATRIZ" && !active) {
    return { ok: false, error: "A matriz não pode ser desativada." };
  }
  await prisma.pharmacy.update({ where: { id }, data: { active } });
  await logAudit({
    action: "pharmacy.active",
    entity: "Pharmacy",
    entityId: id,
    detail: active ? "Ativou a unidade" : "Desativou a unidade",
    pharmacyId: id,
  });
  revalidatePharmacies();
  return { ok: true };
}

export async function archivePharmacy(id: string): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  const ph = await prisma.pharmacy.findUnique({
    where: { id },
    select: { type: true, name: true, archivedAt: true },
  });
  if (!ph) return { ok: false, error: "Unidade não encontrada." };
  if (ph.archivedAt) return { ok: false, error: "A unidade já está arquivada." };
  if (ph?.type === "MATRIZ") {
    return { ok: false, error: "A matriz não pode ser arquivada." };
  }
  const [admins, openOrders] = await Promise.all([
    prisma.user.count({ where: { pharmacyId: id, role: "ADMIN" } }),
    prisma.order.count({
      where: {
        pharmacyId: id,
        archivedAt: null,
        status: { in: ["PENDING", "PAID", "PREPARING", "SHIPPED"] },
      },
    }),
  ]);
  if (admins > 0) {
    return {
      ok: false,
      error: "Revogue ou transfira os administradores desta unidade antes de arquivar.",
    };
  }
  if (openOrders > 0) {
    return {
      ok: false,
      error: "Conclua ou transfira os pedidos em aberto antes de arquivar a unidade.",
    };
  }
  const archivedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.pharmacyCepRange.updateMany({
      where: { pharmacyId: id, archivedAt: null },
      data: { archivedAt },
    });
    await tx.pharmacy.update({
      where: { id },
      data: {
        active: false,
        archivedAt,
      },
    });
  });
  await logAudit({
    action: "pharmacy.archive",
    entity: "Pharmacy",
    entityId: id,
    detail: `Arquivou a unidade "${ph.name}"`,
  });
  revalidatePharmacies();
  return { ok: true };
}

export async function restorePharmacy(id: string): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  const archived = await prisma.pharmacy.findFirst({
    where: { id, type: "FILIAL", archivedAt: { not: null } },
    select: { id: true },
  });
  if (!archived) {
    return { ok: false, error: "Filial arquivada não encontrada." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.pharmacy.update({
        where: { id },
        data: { archivedAt: null, active: false },
      });
      await tx.pharmacyCepRange.updateMany({
        where: { pharmacyId: id, archivedAt: { not: null } },
        data: { archivedAt: null },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") {
      return {
        ok: false,
        error:
          "Não foi possível restaurar: outra unidade passou a atender parte destes CEPs.",
      };
    }
    throw error;
  }
  await logAudit({
    action: "pharmacy.restore",
    entity: "Pharmacy",
    entityId: id,
    detail: "Restaurou a filial como inativa; requer reativação explícita",
    pharmacyId: id,
  });
  revalidatePharmacies();
  return { ok: true };
}

export async function addCepRange(
  pharmacyId: string,
  startCep: string,
  endCep: string,
  kmRaw?: string
): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  const start = cepToInt(startCep);
  const end = cepToInt(endCep);
  if (start == null || end == null) {
    return { ok: false, error: "Use CEPs com 8 dígitos (ex.: 09000-000)." };
  }
  if (start > end) {
    return { ok: false, error: "O CEP inicial deve ser menor ou igual ao final." };
  }
  const pharmacy = await prisma.pharmacy.findFirst({
    where: { id: pharmacyId, archivedAt: null },
    select: { id: true },
  });
  if (!pharmacy) return { ok: false, error: "Unidade não encontrada ou arquivada." };
  const overlap = await prisma.pharmacyCepRange.findFirst({
    where: { archivedAt: null, start: { lte: end }, end: { gte: start } },
    select: { id: true },
  });
  if (overlap) {
    return { ok: false, error: "Esta faixa se sobrepõe a uma cobertura já cadastrada." };
  }
  // km opcional: distância desta faixa até a unidade (base do frete por km).
  let km: number | null = null;
  if (kmRaw && kmRaw.trim()) {
    const n = Number(kmRaw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Distância (km) inválida. Ex.: 3 ou 5,5." };
    }
    km = n;
  }
  try {
    await prisma.pharmacyCepRange.create({ data: { pharmacyId, start, end, km } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2004" || error.code === "P2002")
    ) {
      return {
        ok: false,
        error: "Outra faixa sobreposta foi cadastrada ao mesmo tempo. Revise a cobertura.",
      };
    }
    throw error;
  }
  revalidatePharmacies();
  return { ok: true };
}

export async function removeCepRange(id: string): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  const range = await prisma.pharmacyCepRange.findUnique({
    where: { id },
    select: { archivedAt: true, pharmacy: { select: { archivedAt: true } } },
  });
  if (!range || range.archivedAt || range.pharmacy.archivedAt) {
    return { ok: false, error: "Faixa não encontrada ou unidade arquivada." };
  }
  await prisma.pharmacyCepRange.delete({ where: { id } });
  revalidatePharmacies();
  return { ok: true };
}

/**
 * Define o frete da unidade (override do frete global). Campo vazio = herda o
 * global (null). Só a matriz altera.
 */
export async function setPharmacyShipping(
  id: string,
  flat: string,
  freeMin: string
): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  // "" → null (herda o global); número válido → valor; senão → inválido.
  const parse = (v: string): string | null | undefined => {
    const t = v.trim();
    if (t === "") return null;
    const cents = parseMoneyInputToCents(t);
    return cents === null ? undefined : centsToDecimal(cents);
  };
  const shippingFlat = parse(flat);
  const shippingFreeMin = parse(freeMin);
  if (shippingFlat === undefined || shippingFreeMin === undefined) {
    return { ok: false, error: "Use valores numéricos não negativos (ex.: 12,90)." };
  }
  const updated = await prisma.pharmacy.updateMany({
    where: { id, archivedAt: null },
    data: { shippingFlat, shippingFreeMin },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Unidade não encontrada ou arquivada." };
  }
  await logAudit({
    action: "pharmacy.shipping",
    entity: "Pharmacy",
    entityId: id,
    detail: "Atualizou o frete da unidade",
    pharmacyId: id,
  });
  revalidatePharmacies();
  return { ok: true };
}

/**
 * Define os dados regulatórios (CNPJ + responsável técnico) da unidade. Campo
 * vazio = herda o global de /admin/configuracoes (null). Só a matriz altera.
 */
export async function setPharmacyRegulatory(
  id: string,
  cnpj: string,
  pharmacistName: string,
  pharmacistCrf: string
): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  const updated = await prisma.pharmacy.updateMany({
    where: { id, archivedAt: null },
    data: {
      cnpj: cnpj.trim() || null,
      pharmacistName: pharmacistName.trim() || null,
      pharmacistCrf: pharmacistCrf.trim() || null,
    },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Unidade não encontrada ou arquivada." };
  }
  await logAudit({
    action: "pharmacy.regulatory",
    entity: "Pharmacy",
    entityId: id,
    detail: "Atualizou os dados regulatórios da unidade",
    pharmacyId: id,
  });
  revalidatePharmacies();
  return { ok: true };
}

/**
 * Torna um usuário EXISTENTE admin de uma unidade. A pessoa deve ter criado uma
 * conta antes (não criamos usuário/senha aqui). Admin de matriz = escopo global.
 */
export async function assignUnitAdmin(
  email: string,
  pharmacyId: string
): Promise<PharmacyResult> {
  if (!(await ensureGlobalOwner())) return { ok: false, error: "Sem permissão." };
  const pharmacy = await prisma.pharmacy.findFirst({
    where: { id: pharmacyId, active: true, archivedAt: null },
    select: { id: true },
  });
  if (!pharmacy) return { ok: false, error: "Unidade ativa não encontrada." };
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, role: true, staffProfile: true },
  });
  if (!user) {
    return {
      ok: false,
      error: "Usuário não encontrado. Peça para a pessoa criar uma conta primeiro.",
    };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "ADMIN",
      // Menor privilégio útil para novos admins; perfil ausente nunca eleva acesso.
      staffProfile:
        user.role === "ADMIN" && user.staffProfile ? user.staffProfile : "ATTENDANT",
      pharmacyId,
      sessionVersion: { increment: 1 },
    },
  });
  await logAudit({
    action: "admin.assign",
    entity: "User",
    entityId: user.id,
    detail: `Tornou ${email.trim().toLowerCase()} admin de uma unidade`,
    pharmacyId,
  });
  revalidatePharmacies();
  revalidatePath("/admin/clientes");
  return { ok: true };
}

/** Revoga o acesso admin (volta a ser cliente). Não permite revogar a si mesmo. */
export async function removeUnitAdmin(userId: string): Promise<PharmacyResult> {
  const actor = await ensureGlobalOwner();
  if (!actor) return { ok: false, error: "Sem permissão." };
  if (actor.id === userId) {
    return { ok: false, error: "Você não pode remover seu próprio acesso." };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        role: "CUSTOMER",
        staffProfile: null,
        pharmacyId: null,
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
  ]);
  await logAudit({
    action: "admin.revoke",
    entity: "User",
    entityId: userId,
    detail: `Revogou o acesso admin de ${target?.email ?? userId}`,
  });
  revalidatePharmacies();
  revalidatePath("/admin/clientes");
  return { ok: true };
}
