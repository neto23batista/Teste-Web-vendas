import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidateTag: () => {} }));

import {
  allowedOrderTransitions,
  isValidOrderTransition,
} from "@/lib/orders";

describe("máquina de estados do pedido", () => {
  it("separa o primeiro avanço online do dinheiro na entrega", () => {
    expect(allowedOrderTransitions("PENDING", "card")).toEqual([
      "PAID",
      "CANCELED",
    ]);
    expect(allowedOrderTransitions("PENDING", "cash")).toEqual([
      "PREPARING",
      "CANCELED",
    ]);
  });

  it("permite somente o fluxo progressivo e cancelamento antes do envio", () => {
    expect(isValidOrderTransition("PAID", "PREPARING", "card")).toBe(true);
    expect(isValidOrderTransition("PREPARING", "SHIPPED", "cash")).toBe(true);
    expect(isValidOrderTransition("SHIPPED", "DELIVERED", "cash")).toBe(true);
    expect(isValidOrderTransition("SHIPPED", "CANCELED", "card")).toBe(false);
    expect(isValidOrderTransition("DELIVERED", "PENDING", "card")).toBe(false);
    expect(isValidOrderTransition("CANCELED", "PAID", "card")).toBe(false);
  });
});
