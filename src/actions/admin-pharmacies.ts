"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminScope, getCurrentUser } from "@/lib/session";
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
  await prisma.pharmacy.create({
    data: {
      name,
      slug: await uniquePharmacySlug(name),
      type: data.type,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      phone: data.phone?.trim() || null,
    },
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
  revalidatePharmacies();
  return { ok: true };
}

export async function deletePharmacy(id: string): Promise<PharmacyResult> {
  if (!(await ensureMatriz())) return { ok: false, error: "Sem permissão." };
  const ph = await prisma.pharmacy.findUnique({ where: { id }, select: { type: true } });
  if (ph?.type === "MATRIZ") {
    return { ok: false, error: "A matriz não pode ser excluída." };
  }
  // Cascade remove Inventory e faixas de CEP; pedidos ficam sem unidade (SetNull).
  await prisma.pharmacy.delete({ where: { id } }).catch(() => {});
  revalidatePharmacies();
  return { ok: true };
}

export async function addCepRange(
  pharmacyId: string,
  startCep: string,
  endCep: string
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
  await prisma.pharmacyCepRange.create({ data: { pharmacyId, start, end } });
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
  await prisma.user.update({
    where: { id: userId },
    data: { role: "CUSTOMER", pharmacyId: null },
  });
  revalidatePharmacies();
  revalidatePath("/admin/clientes");
  return { ok: true };
}
