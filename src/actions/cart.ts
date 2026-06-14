"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { CART_COOKIE } from "@/lib/cart";
import { getSelectedPharmacyId } from "@/lib/pharmacy";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

/** Estoque de um produto numa unidade (0 se não houver registro). */
async function unitStock(
  productId: string,
  pharmacyId: string | null
): Promise<number> {
  if (!pharmacyId) return 0;
  const inv = await prisma.inventory.findUnique({
    where: { productId_pharmacyId: { productId, pharmacyId } },
    select: { stock: true },
  });
  return inv?.stock ?? 0;
}

/** Garante um carrinho gravável amarrado à unidade selecionada (cria + cookie). */
async function resolveCartId(pharmacyId: string | null): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    const existing = await prisma.cart.findFirst({ where: { userId: user.id } });
    if (existing) {
      if (pharmacyId && existing.pharmacyId !== pharmacyId) {
        await prisma.cart.update({
          where: { id: existing.id },
          data: { pharmacyId },
        });
      }
      return existing.id;
    }
    const created = await prisma.cart.create({
      data: { userId: user.id, pharmacyId },
    });
    return created.id;
  }

  const store = await cookies();
  let token = store.get(CART_COOKIE)?.value ?? null;
  if (token) {
    const cart = await prisma.cart.findUnique({ where: { sessionToken: token } });
    if (cart) {
      if (pharmacyId && cart.pharmacyId !== pharmacyId) {
        await prisma.cart.update({
          where: { id: cart.id },
          data: { pharmacyId },
        });
      }
      return cart.id;
    }
  }
  token = randomUUID();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  const created = await prisma.cart.create({
    data: { sessionToken: token, pharmacyId },
  });
  return created.id;
}

export async function addToCart(productId: string, qty = 1) {
  const pharmacyId = await getSelectedPharmacyId();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, active: true },
  });
  if (!product || !product.active)
    return { ok: false, error: "Produto indisponível." };

  const stock = await unitStock(productId, pharmacyId);
  if (stock <= 0) return { ok: false, error: "Sem estoque nesta unidade." };

  const cartId = await resolveCartId(pharmacyId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });
  const nextQty = Math.min(stock, (existing?.qty ?? 0) + qty);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, qty: nextQty },
    update: { qty: nextQty },
  });

  revalidatePath("/sacola");
  return { ok: true };
}

/**
 * Carrinho do PRÓPRIO chamador (logado ou convidado via cookie), sem criar nada.
 * Usado para escopar mutações de item ao dono — sem isso, qualquer um poderia
 * alterar/remover itens do carrinho de outra pessoa passando o id do item (IDOR).
 */
async function ownCart(): Promise<{ id: string; pharmacyId: string | null } | null> {
  const user = await getCurrentUser();
  if (user) {
    return prisma.cart.findFirst({
      where: { userId: user.id },
      select: { id: true, pharmacyId: true },
    });
  }
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  if (!token) return null;
  return prisma.cart.findUnique({
    where: { sessionToken: token },
    select: { id: true, pharmacyId: true },
  });
}

export async function updateCartItem(itemId: string, qty: number) {
  const cart = await ownCart();
  if (!cart) return { ok: false };

  // Só age sobre item do PRÓPRIO carrinho (escopo por cartId evita IDOR).
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    select: { id: true, productId: true },
  });
  if (!item) return { ok: false };

  const stock = await unitStock(item.productId, cart.pharmacyId);
  if (qty <= 0 || stock <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { qty: Math.min(stock, qty) },
    });
  }
  revalidatePath("/sacola");
  return { ok: true };
}

export async function removeCartItem(itemId: string) {
  const cart = await ownCart();
  if (!cart) return { ok: false };

  // deleteMany com cartId no filtro: só remove se o item for do próprio carrinho.
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
  revalidatePath("/sacola");
  return { ok: true };
}

