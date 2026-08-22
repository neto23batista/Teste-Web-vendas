import { beforeEach, describe, expect, it, vi } from "vitest";

const productFindUnique = vi.fn();
const inventoryFindUnique = vi.fn();
const cartFindFirst = vi.fn();
const cartItemFindUnique = vi.fn();
const cartItemUpsert = vi.fn();
const getCurrentUser = vi.fn();
const getSelectedPharmacyId = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findUnique: (...args: unknown[]) => productFindUnique(...args) },
    inventory: {
      findUnique: (...args: unknown[]) => inventoryFindUnique(...args),
    },
    cart: {
      findFirst: (...args: unknown[]) => cartFindFirst(...args),
    },
    cartItem: {
      findUnique: (...args: unknown[]) => cartItemFindUnique(...args),
      upsert: (...args: unknown[]) => cartItemUpsert(...args),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

vi.mock("@/lib/pharmacy", () => ({
  getSelectedPharmacyId: (...args: unknown[]) =>
    getSelectedPharmacyId(...args),
}));

vi.mock("@/lib/cart", () => ({ CART_COOKIE: "fv_cart" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

import { addToCart, updateCartItem } from "@/actions/cart";

beforeEach(() => {
  vi.clearAllMocks();
  getSelectedPharmacyId.mockResolvedValue("m");
  getCurrentUser.mockResolvedValue({ id: "u1" });
  productFindUnique.mockResolvedValue({ id: "p1", active: true });
  inventoryFindUnique.mockResolvedValue({ stock: 10 });
  cartFindFirst.mockResolvedValue({ id: "c1", pharmacyId: "m" });
  cartItemFindUnique.mockResolvedValue(null);
  cartItemUpsert.mockResolvedValue({});
});

describe("quantidade do carrinho", () => {
  it.each([-1, -99, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100])(
    "rejeita quantidade manipulada %s antes de consultar ou gravar no banco",
    async (qty: number) => {
      const result = await addToCart("p1", qty);

      expect(result).toMatchObject({ ok: false, error: expect.any(String) });
      expect(getSelectedPharmacyId).not.toHaveBeenCalled();
      expect(productFindUnique).not.toHaveBeenCalled();
      expect(cartItemUpsert).not.toHaveBeenCalled();
    }
  );

  it("persiste uma quantidade inteira positiva válida", async () => {
    const result = await addToCart("p1", 2);

    expect(result).toEqual({ ok: true });
    expect(cartItemUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { cartId: "c1", productId: "p1", qty: 2 },
        update: { qty: 2 },
      })
    );
  });

  it("rejeita quantidade negativa na atualização sem procurar o carrinho", async () => {
    const result = await updateCartItem("item-externo", -2);

    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(cartItemUpsert).not.toHaveBeenCalled();
  });
});
