import { describe, it, expect } from "vitest";
import { isNewOrder, type OrderSignal } from "@/lib/order-chime";

const s = (count: number, latestAt: string | null): OrderSignal => ({ count, latestAt });

describe("isNewOrder", () => {
  it("baseline (prev null) nunca toca", () => {
    expect(isNewOrder(null, s(3, "2026-07-09T10:00:00Z"))).toBe(false);
  });

  it("count sobe → toca", () => {
    expect(isNewOrder(s(2, "2026-07-09T10:00:00Z"), s(3, "2026-07-09T10:05:00Z"))).toBe(true);
  });

  it("latestAt avança com count igual (pedido processado + novo no mesmo tick) → toca", () => {
    expect(isNewOrder(s(2, "2026-07-09T10:00:00Z"), s(2, "2026-07-09T10:05:00Z"))).toBe(true);
  });

  it("primeiro pedido a partir de fila vazia → toca", () => {
    expect(isNewOrder(s(0, null), s(1, "2026-07-09T10:05:00Z"))).toBe(true);
  });

  it("processar pedido (count cai, sem novo) → não toca", () => {
    expect(isNewOrder(s(3, "2026-07-09T10:00:00Z"), s(2, "2026-07-09T10:00:00Z"))).toBe(false);
  });

  it("nada mudou → não toca", () => {
    const sig = s(2, "2026-07-09T10:00:00Z");
    expect(isNewOrder(sig, { ...sig })).toBe(false);
  });

  it("fila esvazia (latestAt vira null) → não toca", () => {
    expect(isNewOrder(s(1, "2026-07-09T10:00:00Z"), s(0, null))).toBe(false);
  });
});
