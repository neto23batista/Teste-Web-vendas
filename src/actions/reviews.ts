"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export type ReviewState = { ok?: boolean; error?: string } | undefined;

/**
 * Cria/atualiza a avaliação do usuário logado para um produto (1 por produto —
 * `@@unique([productId, userId])`). Recalcula a média e a contagem do produto
 * a partir das avaliações aprovadas.
 */
export async function submitReview(
  productId: string,
  slug: string,
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login para avaliar este produto." };

  const rating = Math.round(Number(formData.get("rating")));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { error: "Selecione uma nota de 1 a 5 estrelas." };
  }
  const comment =
    String(formData.get("comment") ?? "").trim().slice(0, 1000) || null;

  // Moderação: toda avaliação (nova ou editada) entra como NÃO aprovada e só
  // aparece na loja depois do OK do dono em /admin/avaliacoes.
  await prisma.review.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    create: { productId, userId: user.id, rating, comment, approved: false },
    update: { rating, comment, approved: false },
  });

  const agg = await prisma.review.aggregate({
    where: { productId, approved: true },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: { rating: agg._avg.rating ?? 0, ratingCount: agg._count },
  });

  revalidatePath(`/produto/${slug}`);
  revalidateTag("products", "max"); // a média/contagem afeta a ordenação das listas
  return { ok: true };
}
