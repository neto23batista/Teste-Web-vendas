import { describe, it, expect } from "vitest";
import { maxRedeemablePoints, pointsToBRL } from "@/lib/loyalty";

describe("pointsToBRL", () => {
  it("converte pontos em reais (1 pt = R$ 0,05)", () => {
    expect(pointsToBRL(100)).toBe(5);
  });
  it("não retorna valor negativo", () => {
    expect(pointsToBRL(-10)).toBe(0);
  });
});

describe("maxRedeemablePoints", () => {
  it("zera quando não há saldo", () => {
    expect(maxRedeemablePoints(0, 100)).toBe(0);
  });
  it("zera quando a base é zero", () => {
    expect(maxRedeemablePoints(100, 0)).toBe(0);
  });
  it("limita pelo saldo disponível", () => {
    // base 1000 → teto 50% = R$500 = 10000 pts; saldo 200 é o limite
    expect(maxRedeemablePoints(200, 1000)).toBe(200);
  });
  it("limita por 50% da base", () => {
    // base 100 → teto R$50 = 1000 pts; saldo 5000 é cortado para 1000
    expect(maxRedeemablePoints(5000, 100)).toBe(1000);
  });
});
