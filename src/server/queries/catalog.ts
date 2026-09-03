import "server-only";

import { getProductBySlug, getProductMetadataBySlug, getRelatedProducts } from "@/lib/catalog";
import { getSelectedPharmacyId } from "@/lib/pharmacy";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserSubscriptionFor } from "@/lib/commerce/subscriptions";
import { prisma } from "@/lib/prisma";

export { getProductMetadataBySlug };

/** A oferta depende da unidade; avaliações e assinatura privadas dependem da sessão. */
export async function getProductDetailView(slug: string) {
  const pharmacyId = await getSelectedPharmacyId();
  const product = await getProductBySlug(slug, pharmacyId);
  if (!product) return null;
  const user = await getCurrentUser();
  const [related, myReview, mySubscription] = await Promise.all([
    getRelatedProducts(product.categoryId, product.id, 10, pharmacyId),
    user ? prisma.review.findUnique({
      where: { productId_userId: { productId: product.id, userId: user.id } },
      select: { rating: true, comment: true },
    }) : null,
    user ? getUserSubscriptionFor(user.id, product.id) : null,
  ]);
  return { product, related, myReview, mySubscription, signedIn: Boolean(user) };
}
