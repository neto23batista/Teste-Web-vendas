"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminScope, getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { cepToInt } from "@/lib/pharmacy";
import { slugify } from "@/lib/utils";
import type { PharmacyType } from "@prisma/client";

export type PharmacyResult = { ok: boolean; error?: string };

// Só a matriz (admin global) gerencia unidades.
async function ensureMatriz(): Promise<boolean> {
  return (await getAdminScope()).isGlobal;
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
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  const name = data.name.trim();
  if (!name) return { ok: false, error: "Informe o nome da unidade." };
  if (data.type === "MATRIZ") {
    const exists = await prisma.pharmacy.findFirst({ where: { type: "MATRIZ" } });
    if (exists) return { ok: false, error: "Já existe uma matriz; cadastre como filial." };
  }
  const created = await prisma.pharmacy.create({
    data: {
      name,
      slug: await uniquePharmacySlug(name),
      type: data.type,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      phone: data.phone?.trim() || null,
    },
  });
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
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  const ph = await prisma.pharmacy.findUnique({ where: { id }, select: { type: true } });
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

export async function deletePharmacy(id: string): Promise<PharmacyResult> {
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  const ph = await prisma.pharmacy.findUnique({ where: { id }, select: { type: true, name: true } });
  if (ph?.type === "MATRIZ") {
    return { ok: false, error: "A matriz não pode ser excluída." };
  }
  // Cascade remove Inventory e faixas de CEP; pedidos ficam sem unidade (SetNull).
  // Só registra na auditoria (e reporta sucesso) se o delete de fato ocorreu.
  const deleted = await prisma.pharmacy
    .delete({ where: { id } })
    .then(() => true)
    .catch(() => false);
  if (!deleted) {
    return { ok: false, error: "Não foi possível excluir a unidade. Tente novamente." };
  }
  await logAudit({
    action: "pharmacy.delete",
    entity: "Pharmacy",
    entityId: id,
    detail: `Excluiu a unidade "${ph?.name ?? id}"`,
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
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  const start = cepToInt(startCep);
  const end = cepToInt(endCep);
  if (start == null || end == null) {
    return { ok: false, error: "Use CEPs com 8 dígitos (ex.: 09000-000)." };
  }
  if (start > end) {
    return { ok: false, error: "O CEP inicial deve ser menor ou igual ao final." };
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
  await prisma.pharmacyCepRange.create({ data: { pharmacyId, start, end, km } });
  revalidatePharmacies();
  return { ok: true };
}

export async function removeCepRange(id: string): Promise<PharmacyResult> {
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  await prisma.pharmacyCepRange.delete({ where: { id } }).catch(() => {});
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
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  // "" → null (herda o global); número válido → valor; senão → inválido.
  const parse = (v: string): number | null | undefined => {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const shippingFlat = parse(flat);
  const shippingFreeMin = parse(freeMin);
  if (shippingFlat === undefined || shippingFreeMin === undefined) {
    return { ok: false, error: "Use valores numéricos não negativos (ex.: 12,90)." };
  }
  await prisma.pharmacy.update({
    where: { id },
    data: { shippingFlat, shippingFreeMin },
  });
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
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  await prisma.pharmacy.update({
    where: { id },
    data: {
      cnpj: cnpj.trim() || null,
      pharmacistName: pharmacistName.trim() || null,
      pharmacistCrf: pharmacistCrf.trim() || null,
    },
  });
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
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    return {
      ok: false,
      error: "Usuário não encontrado. Peça para a pessoa criar uma conta primeiro.",
    };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN", pharmacyId },
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
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  const me = await getCurrentUser();
  if (me?.id === userId) {
    return { ok: false, error: "Você não pode remover seu próprio acesso." };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { role: "CUSTOMER", pharmacyId: null },
  });
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
