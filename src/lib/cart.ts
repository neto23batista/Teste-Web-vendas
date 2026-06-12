import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { CART_COOKIE } from "@/lib/cart-merge";
import type { Prisma } from "@prisma/client";

export { CART_COOKIE };

const cartItemSelect = {
  id: true,
  qty: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      price: true,
      promoPrice: true,
      stock: true,
      requiresPrescription: true,
      images: {
        select: { url: true },
        orderBy: { sort: "asc" as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.CartItemSelect;

export type CartItemView = Prisma.CartItemGetPayload<{ select: typeof cartItemSelect }>;

export type CartView = {
  id: string;
  items: CartItemView[];
  subtotal: number;
  count: number;
  requiresPrescription: boolean;
};

async function readToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

function buildView(id: string, items: CartItemView[]): CartView {
  const subtotal = items.reduce(
    (sum, it) => sum + (it.product.promoPrice ?? it.product.price) * it.qty,
    0
  );
  const count = items.reduce((sum, it) => sum + it.qty, 0);
  const requiresPrescription = items.some((it) => it.product.requiresPrescription);
  return { id, items, subtotal, count, requiresPrescription };
}

/**
 * Lê o carrinho para exibição (header, sacola). SOMENTE LEITURA — RSC-safe.
 * O merge do carrinho-convidado acontece no login (evento `signIn` em auth.ts,
 * via mergeGuestCartIntoUser), não durante a renderização.
 */
export async function getCart(): Promise<CartView | null> {
  const user = await getCurrentUser();

  if (user) {
    const userCart = await prisma.cart.findFirst({ where: { userId: user.id } });
    if (!userCart) return null;
    const items = await prisma.cartItem.findMany({
      where: { cartId: userCart.id },
      select: cartItemSelect,
      orderBy: { id: "asc" },
    });
    return buildView(userCart.id, items);
  }

  const token = await readToken();
  if (!token) return null;
  const cart = await prisma.cart.findUnique({ where: { sessionToken: token } });
  if (!cart) return null;
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: cartItemSelect,
    orderBy: { id: "asc" },
  });
  return buildView(cart.id, items);
}

/**
 * Contagem do badge da sacola. Otimizado: roda em TODA página (header),
 * então evita o join de produtos e as escritas de merge do getCart() —
 * é só uma soma agregada de qty. Sem efeitos colaterais (RSC-safe).
 */
export async function getCartCount(): Promise<number> {
  const [user, token] = await Promise.all([getCurrentUser(), readToken()]);
  if (!user && !token) return 0;

  const cartWhere: Prisma.CartWhereInput =
    user && token
      ? { OR: [{ userId: user.id }, { sessionToken: token }] }
      : user
        ? { userId: user.id }
        : { sessionToken: token! };

  const agg = await prisma.cartItem.aggregate({
    where: { cart: cartWhere },
    _sum: { qty: true },
  });
  return agg._sum.qty ?? 0;
}
