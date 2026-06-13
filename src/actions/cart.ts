"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { CART_COOKIE } from "@/lib/cart";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

/** Garante um carrinho gravável (cria + cookie para convidado). */
async function resolveCartId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    const existing = await prisma.cart.findFirst({ where: { userId: user.id } });
    if (existing) return existing.id;
    const created = await prisma.cart.create({ data: { userId: user.id } });
    return created.id;
  }

  const store = await cookies();
  let token = store.get(CART_COOKIE)?.value ?? null;
  if (token) {
    const cart = await prisma.cart.findUnique({ where: { sessionToken: token } });
    if (cart) return cart.id;
  }
  token = randomUUID();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  const created = await prisma.cart.create({ data: { sessionToken: token } });
  return created.id;
}

export async function addToCart(productId: string, qty = 1) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) return { ok: false, error: "Produto indisponível." };
  if (product.stock <= 0) return { ok: false, error: "Sem estoque." };

  const cartId = await resolveCartId();
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });
  const nextQty = Math.min(product.stock, (existing?.qty ?? 0) + qty);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, qty: nextQty },
    update: { qty: nextQty },
  });

  revalidatePath("/sacola");
  return { ok: true };
}

/**
 * Id do carrinho do PRÓPRIO chamador (usuário logado ou convidado via cookie),
 * sem criar nada. Usado para escopar mutações de item ao dono — sem isso,
 * qualquer um poderia alterar/remover itens do carrinho de outra pessoa
 * passando o id do item (IDOR).
 */
async function ownCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const c = await prisma.cart.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    return c?.id ?? null;
  }
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  if (!token) return null;
  const c = await prisma.cart.findUnique({
    where: { sessionToken: token },
    select: { id: true },
  });
  return c?.id ?? null;
}

export async function updateCartItem(itemId: string, qty: number) {
  const cartId = await ownCartId();
  if (!cartId) return { ok: false };

  // Só age sobre item do PRÓPRIO carrinho (escopo por cartId evita IDOR).
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId },
    include: { product: true },
  });
  if (!item) return { ok: false };

  if (qty <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { qty: Math.min(item.product.stock, qty) },
    });
  }
  revalidatePath("/sacola");
  return { ok: true };
}

export async function removeCartItem(itemId: string) {
  const cartId = await ownCartId();
  if (!cartId) return { ok: false };

  // deleteMany com cartId no filtro: só remove se o item for do próprio carrinho.
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
  revalidatePath("/sacola");
  return { ok: true };
}

export async function clearCart() {
  const user = await getCurrentUser();
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const cart = user
    ? await prisma.cart.findFirst({ where: { userId: user.id } })
    : token
      ? await prisma.cart.findUnique({ where: { sessionToken: token } })
      : null;
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  revalidatePath("/sacola");
  return { ok: true };
}
