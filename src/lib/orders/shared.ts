import { revalidateTag } from "next/cache";
import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Reivindica uma transição de status de forma ATÔMICA: o UPDATE só "pega" se o
 * pedido ainda estiver no estado esperado. É o que impede efeito duplicado
 * quando duas chamadas correm juntas — o webhook do cartão chega mais de uma vez
 * (checkout.session.completed + payment_intent.succeeded, entrega "pelo menos
 * uma vez") e o cancelamento tem dois caminhos (cliente e admin). Só quem
 * efetivamente mudou o status recebe `true` e executa os efeitos colaterais.
 *
 * Compartilhado por fulfillOrder e cancelOrder de propósito: é a única defesa
 * contra a corrida, e ter duas cópias fazia a correção poder divergir numa delas.
 */
export async function claimOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  from: Prisma.OrderWhereInput["status"],
  to: OrderStatus,
): Promise<boolean> {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, status: from },
    data: { status: to },
  });
  return claimed.count === 1;
}

// Invalida o cache das listas de produto (tag "products"). Best-effort: a
// transação de estoque/dinheiro já está commitada, então uma falha de
// revalidação (ex.: chamada fora do contexto de request/render — job, script)
// não deve propagar e "derrubar" uma operação que já teve sucesso no banco.
export function revalidateProductsSafe() {
  try {
    revalidateTag("products", "max");
  } catch {
    // sem contexto de cache (fora do Next runtime) — ignora.
  }
}

/** Matriz como unidade de fallback (pedidos legados sem pharmacyId). */
export async function fallbackPharmacyId(): Promise<string | null> {
  const m = await prisma.pharmacy.findFirst({
    where: { type: "MATRIZ", archivedAt: null },
    select: { id: true },
  });
  return m?.id ?? null;
}
