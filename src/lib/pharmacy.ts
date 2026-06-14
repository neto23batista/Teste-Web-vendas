import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { PharmacyType } from "@prisma/client";

// Cookie que guarda a unidade escolhida pelo cliente (estilo "loja selecionada").
export const PHARMACY_COOKIE = "fv_pharmacy";

export type PharmacyOption = {
  id: string;
  name: string;
  slug: string;
  type: PharmacyType;
};

/** CEP → inteiro de 8 dígitos para comparar com as faixas (null se inválido). */
export function cepToInt(cep: string | null | undefined): number | null {
  const digits = (cep ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return Number(digits);
}

// Unidades ativas — cacheadas (tag "pharmacies"). Mudam raramente; o CRUD de
// unidades no admin revalida a tag. Ordena MATRIZ antes de FILIAL.
export const getActivePharmacies = unstable_cache(
  async (): Promise<PharmacyOption[]> =>
    prisma.pharmacy.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  ["active-pharmacies"],
  { tags: ["pharmacies"], revalidate: 3600 }
);

/** Lista segura para UI (não quebra build/SSR sem banco). */
export async function listPharmaciesSafe(): Promise<PharmacyOption[]> {
  return getActivePharmacies().catch(() => [] as PharmacyOption[]);
}

/** A matriz: fallback de roteamento por CEP e escopo "global" do admin. */
export async function getDefaultPharmacy(): Promise<PharmacyOption | null> {
  const all = await listPharmaciesSafe();
  return all.find((p) => p.type === "MATRIZ") ?? all[0] ?? null;
}

/**
 * Roteia um CEP para a unidade que o atende (primeira faixa que contém o CEP).
 * Sem CEP válido ou sem cobertura, cai na matriz (fallback).
 */
export async function resolvePharmacyByCep(
  cep: string | null | undefined
): Promise<PharmacyOption | null> {
  const fallback = await getDefaultPharmacy();
  const n = cepToInt(cep);
  if (n == null) return fallback;
  const match = await prisma.pharmacyCepRange
    .findFirst({
      where: { start: { lte: n }, end: { gte: n }, pharmacy: { active: true } },
      orderBy: { start: "asc" },
      select: {
        pharmacy: { select: { id: true, name: true, slug: true, type: true } },
      },
    })
    .catch(() => null);
  return match?.pharmacy ?? fallback;
}

/**
 * Id da unidade selecionada pelo cliente (cookie), validado contra as ativas.
 * Sem seleção válida, retorna a matriz. RSC-safe (somente leitura).
 */
export async function getSelectedPharmacyId(): Promise<string | null> {
  const all = await listPharmaciesSafe();
  if (all.length === 0) return null;
  const store = await cookies();
  const cookieId = store.get(PHARMACY_COOKIE)?.value ?? null;
  if (cookieId && all.some((p) => p.id === cookieId)) return cookieId;
  return all.find((p) => p.type === "MATRIZ")?.id ?? all[0].id;
}

/** Unidade selecionada completa (para exibir nome no header etc.). */
export async function getSelectedPharmacy(): Promise<PharmacyOption | null> {
  const id = await getSelectedPharmacyId();
  if (!id) return null;
  const all = await listPharmaciesSafe();
  return all.find((p) => p.id === id) ?? null;
}
