import { prisma } from "@/lib/prisma";
import { assertArea } from "@/lib/auth/session";

/** Avaliações para moderação: pendentes em fila (mais antiga primeiro);
 *  aprovadas em ordem inversa, limitadas às 100 mais recentes. */
export async function getReviewsByApproval(approved: boolean) {
  await assertArea("avaliacoes");
  return prisma.review.findMany({
    where: { approved },
    include: {
      // O e-mail não é usado na moderação e não deve ser carregado.
      user: { select: { name: true } },
      product: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: approved ? "desc" : "asc" },
    ...(approved ? { take: 100 } : {}),
  });
}
