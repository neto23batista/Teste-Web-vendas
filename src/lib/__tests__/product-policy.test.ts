import { describe, expect, it } from "vitest";
import {
  isProductSaleable,
  SALEABLE_PRODUCT_WHERE,
} from "@/lib/product-policy";

describe("política de produtos vendáveis", () => {
  it("exige produto ativo e sem prescrição", () => {
    expect(SALEABLE_PRODUCT_WHERE).toEqual({
      active: true,
      requiresPrescription: false,
    });
    expect(isProductSaleable({ active: true, requiresPrescription: false })).toBe(true);
    expect(isProductSaleable({ active: false, requiresPrescription: false })).toBe(false);
    expect(isProductSaleable({ active: true, requiresPrescription: true })).toBe(false);
  });
});
