"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { addToCart } from "@/actions/cart";

/**
 * Recompra: adiciona à sacola todos os itens de um pedido anterior do próprio
 * usuário. Itens sem produto vinculado, inativos ou sem estoque são ignorados
 * (o `addToCart` já trata e limita pela disponibilidade). Idempotente do ponto
 * de vista de estoque — apenas repõe quantidades no carrinho.
 */
export async function reorder(orderNumber: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Entre na sua conta para recomprar." };

  const order = await prisma.order.findUnique({
    where: { number: orderNumber },
    include: { items: true },
  });
  if (!order || order.userId !== user.id) {
    return { ok: false as const, error: "Pedido não encontrado." };
  }

  let added = 0;
  let skipped = 0;
  for (const item of order.items) {
    if (!item.productId) {
      skipped++;
      continue;
    }
    const res = await addToCart(item.productId, item.qty);
    if (res.ok) added++;
    else skipped++;
  }

  return { ok: true as const, added, skipped };
}
