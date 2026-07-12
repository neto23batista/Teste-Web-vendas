"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea } from "@/lib/session";
import { logAudit } from "@/lib/audit";

/** Recalcula média/contagem do produto a partir das avaliações APROVADAS. */
async function refreshProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, approved: true },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: { rating: agg._avg.rating ?? 0, ratingCount: agg._count },
  });
}

export async function approveReview(id: string) {
  await assertArea("avaliacoes");
  const review = await prisma.review.update({
    where: { id },
    data: { approved: true },
    select: { productId: true, product: { select: { slug: true, name: true } } },
  });
  await refreshProductRating(review.productId);
  await logAudit({
    action: "review.approve",
    entity: "Review",
    entityId: id,
    detail: `Aprovou uma avaliação de "${review.product.name}"`,
  });
  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${review.product.slug}`);
  revalidateTag("products", "max");
  return { ok: true };
}

/** Recusar = excluir (o cliente pode reenviar uma nova avaliação). */
export async function rejectReview(id: string) {
  await assertArea("avaliacoes");
  const review = await prisma.review.delete({
    where: { id },
    select: { productId: true, product: { select: { slug: true, name: true } } },
  });
  await refreshProductRating(review.productId);
  await logAudit({
    action: "review.reject",
    entity: "Review",
    entityId: id,
    detail: `Recusou (excluiu) uma avaliação de "${review.product.name}"`,
  });
  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${review.product.slug}`);
  revalidateTag("products", "max");
  return { ok: true };
}
