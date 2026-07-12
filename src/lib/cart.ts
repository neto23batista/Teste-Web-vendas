import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { CART_COOKIE } from "@/lib/cart-merge";
import { getDefaultPharmacy } from "@/lib/pharmacy";
import type { Prisma } from "@prisma/client";

export { CART_COOKIE };

// Estoque do item = o da unidade do carrinho (cart.pharmacyId). O select é
// montado com a unidade resolvida em getCart.
function cartItemSelect(pharmacyId: string | null) {
  return {
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
        inventory: {
          where: pharmacyId ? { pharmacyId } : undefined,
          select: { stock: true },
        },
        images: {
          select: { url: true },
          orderBy: { sort: "asc" as const },
          take: 1,
        },
      },
    },
  } satisfies Prisma.CartItemSelect;
}

type CartItemRow = Prisma.CartItemGetPayload<{
  select: ReturnType<typeof cartItemSelect>;
}>;

export type CartItemView = {
  id: string;
  qty: number;
  product: Omit<CartItemRow["product"], "inventory"> & { stock: number };
};

export type CartView = {
  id: string;
  pharmacyId: string | null;
  items: CartItemView[];
  subtotal: number;
  count: number;
};

function toItemView(row: CartItemRow): CartItemView {
  const { inventory, ...product } = row.product;
  const stock = inventory.reduce((sum, i) => sum + i.stock, 0);
  return { id: row.id, qty: row.qty, product: { ...product, stock } };
}

async function readToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

function buildView(
  id: string,
  pharmacyId: string | null,
  items: CartItemView[]
): CartView {
  const subtotal = items.reduce(
    (sum, it) => sum + (it.product.promoPrice ?? it.product.price) * it.qty,
    0
  );
  const count = items.reduce((sum, it) => sum + it.qty, 0);
  return { id, pharmacyId, items, subtotal, count };
}

/**
 * Lê o carrinho para exibição (header, sacola). SOMENTE LEITURA — RSC-safe.
 * O estoque mostrado é o da unidade do carrinho (cart.pharmacyId), com a matriz
 * como fallback. O merge do carrinho-convidado acontece no login (auth.ts).
 */
export async function getCart(): Promise<CartView | null> {
  const user = await getCurrentUser();

  let cart: { id: string; pharmacyId: string | null } | null = null;
  if (user) {
    cart = await prisma.cart.findFirst({
      where: { userId: user.id },
      select: { id: true, pharmacyId: true },
    });
  } else {
    const token = await readToken();
    if (token) {
      cart = await prisma.cart.findUnique({
        where: { sessionToken: token },
        select: { id: true, pharmacyId: true },
      });
    }
  }
  if (!cart) return null;

  const pharmacyId = cart.pharmacyId ?? (await getDefaultPharmacy())?.id ?? null;
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: cartItemSelect(pharmacyId),
    orderBy: { id: "asc" },
  });
  return buildView(cart.id, pharmacyId, items.map(toItemView));
}

/**
 * Contagem do badge da sacola. Otimizado: roda em TODA página (header),
 * então evita o join de produtos — é só uma soma agregada de qty. RSC-safe.
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
