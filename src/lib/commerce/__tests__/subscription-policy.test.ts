import { describe, expect, it } from "vitest";
import {
  intervalLabel,
  isValidInterval,
  SUBSCRIPTION_INTERVALS,
} from "../subscription-policy";

describe("política pública de reposição", () => {
  it("oferece somente os três intervalos suportados", () => {
    expect(SUBSCRIPTION_INTERVALS).toEqual([30, 60, 90]);
  });
  it.each([30, 60, 90])("aceita %s dias", (days) => {
    expect(isValidInterval(days)).toBe(true);
  });
  it.each([0, -30, 31, 30.5, NaN, Infinity])(
    "recusa intervalo inválido %s",
    (days) => {
      expect(isValidInterval(days)).toBe(false);
    },
  );
  it("preserva os rótulos exibidos ao cliente", () => {
    expect(SUBSCRIPTION_INTERVALS.map(intervalLabel)).toEqual([
      "Mensal",
      "A cada 2 meses",
      "A cada 3 meses",
    ]);
  });
});
