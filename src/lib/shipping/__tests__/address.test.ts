import { describe, expect, it } from "vitest";
import { addressFromFormData, validateAddress } from "@/lib/shipping/address";

function validForm() {
  const form = new FormData();
  form.set("recipient", "  Maria Silva  ");
  form.set("zip", "01001-000");
  form.set("street", "Praça da Sé");
  form.set("number", "1");
  form.set("district", "Sé");
  form.set("city", "São Paulo");
  form.set("state", "sp");
  return form;
}

describe("address", () => {
  it("normaliza CEP, UF e espaços para qualquer fluxo", () => {
    const address = addressFromFormData(validForm());
    expect(address).toMatchObject({
      recipient: "Maria Silva",
      zip: "01001000",
      state: "SP",
    });
    expect(validateAddress(address)).toBeNull();
  });

  it("rejeita CEP e campos acima dos limites", () => {
    const form = validForm();
    form.set("zip", "123");
    expect(validateAddress(addressFromFormData(form))).toMatch(/CEP/i);
    form.set("zip", "01001000");
    form.set("street", "x".repeat(161));
    expect(validateAddress(addressFromFormData(form))).toMatch(/tamanho/i);
  });
});
