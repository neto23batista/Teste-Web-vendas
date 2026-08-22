import { describe, expect, it } from "vitest";
import {
  centsToDecimal,
  centsToNumber,
  moneyToCents,
  moneyToNumber,
  parseMoneyInputToCents,
  percentageOfCents,
} from "@/lib/money";

describe("money", () => {
  it("converte decimais sem ruído binário", () => {
    expect(moneyToCents("19.90")).toBe(1990);
    expect(moneyToCents({ toString: () => "123456.78" })).toBe(12_345_678);
    expect(moneyToCents("1.005")).toBe(101);
    expect(centsToDecimal(1990)).toBe("19.90");
  });

  it("valida a escala de entradas humanas", () => {
    expect(parseMoneyInputToCents("R$ 12,34")).toBe(1234);
    expect(parseMoneyInputToCents("12,345")).toBeNull();
    expect(parseMoneyInputToCents("-1,00")).toBeNull();
    expect(parseMoneyInputToCents("-1,00", { allowNegative: true })).toBe(-100);
  });

  it("converte para number apenas na fronteira", () => {
    expect(moneyToNumber("12.34")).toBe(12.34);
    expect(centsToNumber(1234)).toBe(12.34);
    expect(moneyToCents(Number.NaN)).toBeNull();
  });

  it("aplica percentual usando inteiros", () => {
    expect(percentageOfCents(9_999, "12.50")).toBe(1_250);
  });
});
