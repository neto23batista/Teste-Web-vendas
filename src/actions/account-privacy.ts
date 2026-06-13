"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";

export type DeleteAccountState = { error?: string } | undefined;

/**
 * Exclusão de conta (LGPD, art. 18): apaga os dados pessoais e ANONIMIZA o
 * usuário. Pedidos são mantidos (obrigação fiscal/contábil), mas ficam
 * desvinculados de qualquer dado pessoal:
 * - apaga endereços (Order.addressId vira NULL), carrinhos, favoritos,
 *   receitas, tokens de senha, avaliações e a conta de fidelidade;
 * - troca nome/e-mail por valores anônimos e invalida a senha.
 * Os arquivos de receita no storage ficam órfãos (sem vínculo identificável).
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const user = await requireUser();

  const confirm = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  if (confirm !== user.email?.toLowerCase()) {
    return { error: "Digite o e-mail da conta exatamente como cadastrado para confirmar." };
  }

  // Produtos com avaliação deste usuário — para recalcular a média depois.
  const reviewed = await prisma.review.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });

  await prisma.$transaction([
    prisma.address.deleteMany({ where: { userId: user.id } }),
    prisma.cart.deleteMany({ where: { userId: user.id } }),
    prisma.favorite.deleteMany({ where: { userId: user.id } }),
    prisma.prescription.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.review.deleteMany({ where: { userId: user.id } }),
    prisma.loyaltyAccount.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: "Conta excluída",
        email: `excluida-${user.id}@anon.invalid`,
        passwordHash: crypto.randomBytes(32).toString("hex"),
        cpf: null,
        phone: null,
      },
    }),
  ]);

  // Recalcula média/contagem dos produtos que perderam avaliações.
  for (const { productId } of new Map(reviewed.map((r) => [r.productId, r])).values()) {
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

  await signOut({ redirectTo: "/?conta=excluida" });
}
