"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { CART_COOKIE } from "@/lib/cart-merge";
import {
  PHARMACY_COOKIE,
  listPharmaciesSafe,
  resolvePharmacyByCep,
} from "@/lib/pharmacy";

const MAX_AGE = 60 * 60 * 24 * 180; // 180 dias

/** Amarra o carrinho do chamador (logado ou convidado) à unidade escolhida. */
async function bindCartToPharmacy(pharmacyId: string) {
  const user = await getCurrentUser();
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const cart = user
    ? await prisma.cart.findFirst({ where: { userId: user.id }, select: { id: true } })
    : token
      ? await prisma.cart.findUnique({
          where: { sessionToken: token },
          select: { id: true },
        })
      : null;
  if (cart) {
    await prisma.cart.update({ where: { id: cart.id }, data: { pharmacyId } });
  }
}

export type SetPharmacyResult =
  | { ok: true; pharmacyId: string; name: string }
  | { ok: false; error: string };

/**
 * Define a unidade da loja: por CEP (roteia para a unidade que atende; matriz
 * como fallback) ou por id explícito. Grava o cookie e sincroniza o carrinho.
 */
export async function setSelectedPharmacy(input: {
  cep?: string;
  pharmacyId?: string;
}): Promise<SetPharmacyResult> {
  const all = await listPharmaciesSafe();
  if (all.length === 0) {
    return { ok: false, error: "Nenhuma unidade disponível no momento." };
  }

  let chosen = input.pharmacyId
    ? all.find((p) => p.id === input.pharmacyId) ?? null
    : null;

  if (!chosen && input.cep) {
    const resolved = await resolvePharmacyByCep(input.cep);
    chosen = resolved ? all.find((p) => p.id === resolved.id) ?? null : null;
    if (!chosen) {
      return { ok: false, error: "Não encontramos uma unidade para este CEP." };
    }
  }

  if (!chosen) return { ok: false, error: "Unidade indisponível." };

  const store = await cookies();
  store.set(PHARMACY_COOKIE, chosen.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  await bindCartToPharmacy(chosen.id);

  // Disponibilidade/estoque mudam com a unidade — revalida a loja inteira.
  revalidatePath("/", "layout");
  return { ok: true, pharmacyId: chosen.id, name: chosen.name };
}
