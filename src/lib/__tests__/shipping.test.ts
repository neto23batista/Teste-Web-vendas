import { describe, it, expect } from "vitest";
import {
  shippingFor,
  missingForFreeShipping,
  FREE_SHIPPING_MIN,
  SHIPPING_FLAT,
} from "@/lib/shipping";

describe("shippingFor", () => {
  it("é grátis para carrinho vazio", () => {
    expect(shippingFor(0)).toBe(0);
  });
  it("cobra frete fixo abaixo do mínimo", () => {
    expect(shippingFor(100)).toBe(SHIPPING_FLAT);
  });
  it("é grátis exatamente no mínimo", () => {
    expect(shippingFor(FREE_SHIPPING_MIN)).toBe(0);
  });
  it("é grátis acima do mínimo", () => {
    expect(shippingFor(FREE_SHIPPING_MIN + 50)).toBe(0);
  });
  it("usa o valor padrão quando o CEP é desconhecido", () => {
    expect(shippingFor(100)).toBe(SHIPPING_FLAT);
  });
  it("calcula por região do CEP de destino", () => {
    // CEP de SP (começa com 0) e do Norte (começa com 6) têm custos diferentes
    expect(shippingFor(100, "01001-000")).toBe(14.9);
    expect(shippingFor(100, "69000-000")).toBe(27.9);
  });
});

describe("missingForFreeShipping", () => {
  it("calcula o quanto falta para frete grátis", () => {
    expect(missingForFreeShipping(FREE_SHIPPING_MIN - 50)).toBe(50);
  });
  it("não retorna valor negativo", () => {
    expect(missingForFreeShipping(FREE_SHIPPING_MIN + 100)).toBe(0);
  });
});
