import { beforeEach, describe, expect, it, vi } from "vitest";

const productFindUnique = vi.fn();
const subscriptionFindFirst = vi.fn();
const subscriptionUpsert = vi.fn();
const subscriptionUpdate = vi.fn();
const addToCart = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findUnique: (...args: unknown[]) => productFindUnique(...args) },
    subscription: {
      findFirst: (...args: unknown[]) => subscriptionFindFirst(...args),
      upsert: (...args: unknown[]) => subscriptionUpsert(...args),
      update: (...args: unknown[]) => subscriptionUpdate(...args),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  requireUser: async () => ({ id: "user-1" }),
}));

vi.mock("@/actions/cart", () => ({
  addToCart: (...args: unknown[]) => addToCart(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import {
  refillNow,
  resumeSubscription,
  subscribeToProduct,
} from "@/actions/subscriptions";

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionUpsert.mockResolvedValue({});
  subscriptionUpdate.mockResolvedValue({});
  addToCart.mockResolvedValue({ ok: true });
});

describe("assinaturas MIP-only", () => {
  it("recusa quantidade fora do intervalo em chamada direta", async () => {
    const result = await subscribeToProduct("mip-1", 30, -5);

    expect(result).toEqual({
      ok: false,
      error: "Quantidade deve ser um inteiro entre 1 e 10.",
    });
    expect(productFindUnique).not.toHaveBeenCalled();
    expect(subscriptionUpsert).not.toHaveBeenCalled();
  });

  it("recusa uma nova assinatura de produto com receita", async () => {
    productFindUnique.mockResolvedValue({ active: true, requiresPrescription: true });

    const result = await subscribeToProduct("rx-1", 30, 1);

    expect(result).toEqual({
      ok: false,
      error: "Medicamentos que exigem receita não são vendidos por este canal.",
    });
    expect(subscriptionUpsert).not.toHaveBeenCalled();
  });

  it("não reativa assinatura antiga quando o produto exige receita", async () => {
    subscriptionFindFirst.mockResolvedValue({
      id: "sub-1",
      productId: "rx-1",
      qty: 1,
      intervalDays: 30,
      status: "PAUSED",
      product: { active: true, requiresPrescription: true },
    });

    const result = await resumeSubscription("sub-1");

    expect(result.ok).toBe(false);
    expect(subscriptionUpdate).not.toHaveBeenCalled();
  });

  it("não repõe assinatura antiga de produto com receita", async () => {
    subscriptionFindFirst.mockResolvedValue({
      id: "sub-1",
      productId: "rx-1",
      qty: 1,
      intervalDays: 30,
      status: "ACTIVE",
      product: { active: true, requiresPrescription: true },
    });

    const result = await refillNow("sub-1");

    expect(result.ok).toBe(false);
    expect(addToCart).not.toHaveBeenCalled();
    expect(subscriptionUpdate).not.toHaveBeenCalled();
  });
});
