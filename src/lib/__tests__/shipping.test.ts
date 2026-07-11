import { describe, it, expect } from "vitest";
import {
  shippingFor,
  missingForFreeShipping,
  deliveryOptions,
  FREE_SHIPPING_MIN,
  FREE_RADIUS_KM,
} from "@/lib/shipping";

describe("shippingFor — frete padrão", () => {
  it("é grátis para carrinho vazio", () => {
    expect(shippingFor(0, 10)).toBe(0);
  });
  it("é grátis a partir do mínimo dentro do raio (4 km)", () => {
    expect(shippingFor(FREE_SHIPPING_MIN, 0)).toBe(0);
    expect(shippingFor(FREE_SHIPPING_MIN, FREE_RADIUS_KM)).toBe(0);
    expect(shippingFor(50, 4)).toBe(0);
  });
  it("cobra R$1 por km excedente além do raio (acima do mínimo)", () => {
    expect(shippingFor(50, 5)).toBe(1); // 5 − 4 = 1 km
    expect(shippingFor(50, 10)).toBe(6); // 10 − 4 = 6 km
  });
  it("abaixo do mínimo, cobra R$1 por km desde o km 0 (sem raio grátis)", () => {
    expect(shippingFor(8, 3)).toBe(3);
    expect(shippingFor(8, 0)).toBe(0);
  });
  it("distância nula/desconhecida vira grátis no padrão", () => {
    expect(shippingFor(50, null)).toBe(0);
    expect(shippingFor(50, undefined)).toBe(0);
  });
});

describe("shippingFor — Entrega Rápida", () => {
  it("cobra taxa fixa R$5 + R$1 por km percorrido", () => {
    expect(shippingFor(50, 0, "express")).toBe(5);
    expect(shippingFor(50, 3, "express")).toBe(8);
    expect(shippingFor(200, 6, "express")).toBe(11); // premium, nunca grátis
  });
});

describe("deliveryOptions", () => {
  it("devolve as duas modalidades com preço calculado", () => {
    const opts = deliveryOptions(50, 6);
    expect(opts.map((o) => o.method)).toEqual(["standard", "express"]);
    expect(opts[0].price).toBe(2); // padrão: (6 − 4) km
    expect(opts[1].price).toBe(11); // rápida: 5 + 6
  });
});

describe("missingForFreeShipping", () => {
  it("calcula o quanto falta para o mínimo de frete grátis", () => {
    expect(missingForFreeShipping(FREE_SHIPPING_MIN - 4)).toBe(4);
  });
  it("não retorna valor negativo", () => {
    expect(missingForFreeShipping(FREE_SHIPPING_MIN + 100)).toBe(0);
  });
});
