"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * Espelha o favorito na conta do usuário (no-op silencioso para visitantes).
 * A UI é otimista via localStorage — esta action é o backup por conta.
 */
export async function toggleFavorite(productId: string, fav: boolean) {
  const user = await getCurrentUser();
  if (!user) return { ok: true };
  try {
    if (fav) {
      await prisma.favorite.upsert({
        where: { userId_productId: { userId: user.id, productId } },
        create: { userId: user.id, productId },
        update: {},
      });
    } else {
      await prisma.favorite.deleteMany({
        where: { userId: user.id, productId },
      });
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Junta os favoritos do dispositivo com os da conta e devolve a lista
 * completa (ids) — usada para sincronizar ao abrir "Meus favoritos" logado.
 */
export async function mergeFavorites(localIds: string[]) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, ids: [] as string[] };

  const ids = [...new Set(localIds)].filter(
    (x) => typeof x === "string" && x.length > 0 && x.length < 64
  );
  if (ids.length > 0) {
    // Só produtos que existem (ids antigos/dev podem não existir mais).
    const valid = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (valid.length > 0) {
      await prisma.favorite.createMany({
        data: valid.map((p) => ({ userId: user.id, productId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  const all = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });
  return { ok: true as const, ids: all.map((f) => f.productId) };
}
