import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Nome do cookie do carrinho-convidado. Fica aqui (módulo sem dependência de
// session/auth) para evitar ciclo de import com `auth.ts`.
export const CART_COOKIE = "fv_cart";

/**
 * Mescla o carrinho-convidado (cookie) no carrinho do usuário ao logar.
 * Chamado pelo evento `signIn` em `auth.ts` — fora do caminho de renderização
 * (RSC), portanto sem efeitos colaterais durante o render.
 */
export async function mergeGuestCartIntoUser(userId: string): Promise<void> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  if (!token) return;

  const guest = await prisma.cart.findUnique({
    where: { sessionToken: token },
    include: { items: true },
  });
  if (!guest || guest.userId !== null || guest.items.length === 0) return;

  let userCart = await prisma.cart.findFirst({ where: { userId } });
  if (!userCart) userCart = await prisma.cart.create({ data: { userId } });

  for (const item of guest.items) {
    await prisma.cartItem.upsert({
      where: {
        cartId_productId: { cartId: userCart.id, productId: item.productId },
      },
      create: { cartId: userCart.id, productId: item.productId, qty: item.qty },
      update: { qty: { increment: item.qty } },
    });
  }
  await prisma.cart.delete({ where: { id: guest.id } });
}
