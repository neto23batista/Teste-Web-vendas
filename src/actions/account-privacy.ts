"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  enqueueStorageDeletions,
  processStorageDeletionTasks,
} from "@/lib/storage-deletions";
import { reportError } from "@/lib/monitoring";

export type DeleteAccountState = { error?: string } | undefined;

/**
 * Exclusão de conta (LGPD, art. 18): apaga os dados pessoais e ANONIMIZA o
 * usuário. Pedidos, pagamentos e evidências obrigatórias podem ser mantidos
 * pelo prazo fiscal, regulatório ou de defesa aplicável, com acesso restrito:
 * - apaga endereços (Order.addressId vira NULL), carrinhos, favoritos,
 *   receitas, tokens de senha, avaliações e a conta de fidelidade;
 * - troca o cadastro principal por valores anônimos, remove privilégios e invalida a senha;
 * - registra os documentos privados numa fila durável, na mesma transação, e
 *   apaga os objetos de forma idempotente logo após o commit ou pelo cron.
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

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, passwordHash: true, email: true },
  });
  if (!current) return { error: "Conta não encontrada." };
  if (current.role === "ADMIN") {
    return {
      error:
        "Contas administrativas precisam passar pelo desligamento da equipe antes da exclusão.",
    };
  }

  const ip = await clientIp();
  if (!(await rateLimit(`account-delete:${ip}:${user.id}`, 5, 15 * 60_000)).ok) {
    return { error: "Muitas tentativas. Aguarde antes de tentar novamente." };
  }
  const currentPassword = String(formData.get("currentPassword") ?? "");
  if (
    currentPassword.length > 128 ||
    !(await verifyPassword(currentPassword, current.passwordHash))
  ) {
    return { error: "Senha atual incorreta." };
  }

  const documents = await prisma.prescription.findMany({
    where: { userId: user.id },
    select: { fileUrl: true },
  });
  // Produtos com avaliação deste usuário — para recalcular a média depois.
  const reviewed = await prisma.review.findMany({
    where: { userId: user.id },
    select: { productId: true },
  });

  const invalidPasswordHash = await hashPassword(
    crypto.randomBytes(32).toString("base64url")
  );

  await prisma.$transaction(async (tx) => {
    await enqueueStorageDeletions(
      tx,
      documents.map(({ fileUrl }) => fileUrl)
    );
    await tx.favorite.deleteMany({ where: { userId: user.id } });
    await tx.subscription.deleteMany({ where: { userId: user.id } });
    await tx.address.deleteMany({ where: { userId: user.id } });
    await tx.cart.deleteMany({ where: { userId: user.id } });
    await tx.prescription.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.review.deleteMany({ where: { userId: user.id } });
    await tx.loyaltyAccount.deleteMany({ where: { userId: user.id } });
    // Preserva a evidência do evento, mas rompe o vínculo e remove snapshots do
    // próprio titular. Também minimiza menções ao e-mail em logs de outro ator.
    await tx.auditLog.updateMany({
      where: { userId: user.id },
      data: {
        userId: null,
        userEmail: null,
        detail: "Evento preservado após anonimização da conta",
      },
    });
    await tx.auditLog.updateMany({
      where: { detail: { contains: current.email, mode: "insensitive" } },
      data: { detail: "Evento preservado; referência pessoal removida" },
    });
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: "Conta excluída",
        email: `excluida-${user.id}@anon.invalid`,
        passwordHash: invalidPasswordHash,
        role: "CUSTOMER",
        staffProfile: null,
        pharmacyId: null,
        cpf: null,
        phone: null,
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        sessionVersion: { increment: 1 },
      },
    });
  });

  // A intenção de apagar já está confirmada no banco; tentar agora reduz a
  // janela de retenção, e qualquer indisponibilidade fica para o cron retomar.
  if (documents.length > 0) {
    try {
      await processStorageDeletionTasks(Math.min(documents.length, 25));
    } catch (error) {
      reportError(error, { operation: "account_delete.process_storage_queue" });
    }
  }

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
