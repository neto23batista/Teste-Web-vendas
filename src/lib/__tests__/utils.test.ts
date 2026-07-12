import { describe, it, expect } from "vitest";
import { slugify, discountPercent, formatBRL, jsonLdScript } from "@/lib/utils";

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

describe("jsonLdScript", () => {
  it("neutraliza um </script> vindo do nome do produto (XSS)", () => {
    const out = jsonLdScript({
      name: "Dipirona</script><img src=x onerror=alert(1)>",
    });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("escapa & e os separadores de linha U+2028/U+2029", () => {
    const out = jsonLdScript({
      amp: "A & B",
      sep: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`,
    });
    expect(out).not.toContain("&");
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
  });

  it("preserva os dados: o JSON continua sendo lido igual", () => {
    const data = { name: "Vitamina C & D <3", price: 19.9 };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });
});
