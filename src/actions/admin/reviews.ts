"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea } from "@/lib/auth/session";
import { logAuditInTransaction } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

/**
 * Recalcula média/contagem do produto a partir das avaliações APROVADAS.
 * Recebe o cliente da transação: a nota exibida na loja precisa mudar junto com
 * a moderação, e não numa escrita solta que pode falhar sozinha.
 */
async function refreshProductRating(
  productId: string,
  tx: Prisma.TransactionClient,
) {
  const agg = await tx.review.aggregate({
    where: { productId, approved: true },
    _avg: { rating: true },
    _count: true,
  });
  await tx.product.update({
    where: { id: productId },
    data: { rating: agg._avg.rating ?? 0, ratingCount: agg._count },
  });
}

export async function approveReview(id: string) {
  const actor = await assertArea("avaliacoes");
  const review = await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id },
      data: { approved: true },
      select: { productId: true, product: { select: { slug: true, name: true } } },
    });
    await refreshProductRating(updated.productId, tx);
    await logAuditInTransaction(tx, {
      action: "review.approve",
      entity: "Review",
      entityId: id,
      detail: `Aprovou uma avaliação de "${updated.product.name}"`,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
    return updated;
  });
  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${review.product.slug}`);
  revalidateTag("products", "max");
  return { ok: true };
}

/** Recusar = excluir (o cliente pode reenviar uma nova avaliação). */
export async function rejectReview(id: string) {
  const actor = await assertArea("avaliacoes");
  const review = await prisma.$transaction(async (tx) => {
    const removed = await tx.review.delete({
      where: { id },
      select: { productId: true, product: { select: { slug: true, name: true } } },
    });
    await refreshProductRating(removed.productId, tx);
    await logAuditInTransaction(tx, {
      action: "review.reject",
      entity: "Review",
      entityId: id,
      detail: `Recusou (excluiu) uma avaliação de "${removed.product.name}"`,
      actor: { id: actor.id ?? null, email: actor.email ?? null },
    });
    return removed;
  });
  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${review.product.slug}`);
  revalidateTag("products", "max");
  return { ok: true };
}
