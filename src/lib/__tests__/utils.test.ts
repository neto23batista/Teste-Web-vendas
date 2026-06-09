import { describe, it, expect } from "vitest";
import { slugify, discountPercent, formatBRL } from "@/lib/utils";

describe("slugify", () => {
  it("normaliza acentos e espaços", () => {
    expect(slugify("Dipirona Sódica 500mg")).toBe("dipirona-sodica-500mg");
  });
  it("remove caracteres especiais nas pontas", () => {
    expect(slugify("Vitamina C+!")).toBe("vitamina-c");
  });
});

describe("discountPercent", () => {
  it("calcula o percentual de desconto", () => {
    expect(discountPercent(100, 75)).toBe(25);
  });
  it("retorna 0 sem preço promocional", () => {
    expect(discountPercent(100, null)).toBe(0);
  });
  it("retorna 0 quando a promo não é menor que o preço", () => {
    expect(discountPercent(100, 120)).toBe(0);
  });
});

describe("formatBRL", () => {
  it("formata número como moeda BRL", () => {
    const s = formatBRL(10);
    expect(s).toContain("R$");
    expect(s).toContain("10,00");
  });
  it("trata valores inválidos como zero", () => {
    expect(formatBRL("abc")).toContain("0,00");
  });
});
