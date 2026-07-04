"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { addToCart } from "@/actions/cart";
import { isValidInterval } from "@/lib/subscriptions";

export type SubscriptionActionResult = { ok: boolean; error?: string };

// Antes da migration `subscriptions` rodar, a tabela não existe (P2021/P2022):
// falha com mensagem amigável em vez de estourar o error boundary.
function missingTable(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2022")
  );
}
const NOT_READY = "Assinaturas ainda não estão disponíveis. Tente mais tarde.";

/** Cria (ou reativa) a assinatura de reposição de um produto. */
export async function subscribeToProduct(
  productId: string,
  intervalDays: number,
  qty = 1
): Promise<SubscriptionActionResult> {
  const user = await requireUser();
  if (!isValidInterval(intervalDays)) {
    return { ok: false, error: "Frequência inválida." };
  }
  const safeQty = Math.min(10, Math.max(1, Math.trunc(qty)));

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { active: true, requiresPrescription: true },
  });
  if (!product || !product.active) {
    return { ok: false, error: "Produto indisponível." };
  }
  if (product.requiresPrescription) {
    return {
      ok: false,
      error: "Produtos com receita exigem validação a cada compra e não podem ser assinados.",
    };
  }

  const nextDueAt = new Date(Date.now() + intervalDays * 86_400_000);
  try {
    await prisma.subscription.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      create: { userId: user.id, productId, qty: safeQty, intervalDays, nextDueAt },
      update: {
        qty: safeQty,
        intervalDays,
        status: "ACTIVE",
        nextDueAt,
        lastNotifiedAt: null,
      },
    });
  } catch (err) {
    if (missingTable(err)) return { ok: false, error: NOT_READY };
    throw err;
  }

  revalidatePath("/conta/assinaturas");
  return { ok: true };
}

/** Assinatura do PRÓPRIO usuário (evita IDOR nas mutações abaixo). */
async function ownSubscription(id: string) {
  const user = await requireUser();
  try {
    return await prisma.subscription.findFirst({
      where: { id, userId: user.id },
      select: { id: true, productId: true, qty: true, intervalDays: true, status: true },
    });
  } catch (err) {
    if (missingTable(err)) return null;
    throw err;
  }
}

export async function pauseSubscription(id: string): Promise<SubscriptionActionResult> {
  const sub = await ownSubscription(id);
  if (!sub) return { ok: false, error: "Assinatura não encontrada." };
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAUSED" } });
  revalidatePath("/conta/assinaturas");
  return { ok: true };
}

export async function resumeSubscription(id: string): Promise<SubscriptionActionResult> {
  const sub = await ownSubscription(id);
  if (!sub) return { ok: false, error: "Assinatura não encontrada." };
  // Retomar reinicia o ciclo a partir de hoje.
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: "ACTIVE",
      nextDueAt: new Date(Date.now() + sub.intervalDays * 86_400_000),
      lastNotifiedAt: null,
    },
  });
  revalidatePath("/conta/assinaturas");
  return { ok: true };
}

export async function cancelSubscription(id: string): Promise<SubscriptionActionResult> {
  const sub = await ownSubscription(id);
  if (!sub) return { ok: false, error: "Assinatura não encontrada." };
  await prisma.subscription.delete({ where: { id: sub.id } });
  revalidatePath("/conta/assinaturas");
  return { ok: true };
}

export async function updateSubscriptionInterval(
  id: string,
  intervalDays: number
): Promise<SubscriptionActionResult> {
  if (!isValidInterval(intervalDays)) {
    return { ok: false, error: "Frequência inválida." };
  }
  const sub = await ownSubscription(id);
  if (!sub) return { ok: false, error: "Assinatura não encontrada." };
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      intervalDays,
      nextDueAt: new Date(Date.now() + intervalDays * 86_400_000),
    },
  });
  revalidatePath("/conta/assinaturas");
  return { ok: true };
}

/** Coloca o item na sacola agora e reinicia o ciclo da assinatura. */
export async function refillNow(id: string): Promise<SubscriptionActionResult> {
  const sub = await ownSubscription(id);
  if (!sub) return { ok: false, error: "Assinatura não encontrada." };

  const added = await addToCart(sub.productId, sub.qty);
  if (!added.ok) {
    return { ok: false, error: added.error ?? "Não foi possível adicionar à sacola." };
  }

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      nextDueAt: new Date(Date.now() + sub.intervalDays * 86_400_000),
      lastNotifiedAt: null,
      status: "ACTIVE",
    },
  });
  revalidatePath("/conta/assinaturas");
  return { ok: true };
}
