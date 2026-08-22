import { describe, expect, it } from "vitest";
import { isValidCpf, onlyDigits } from "@/lib/cpf";

describe("CPF", () => {
  it("aceita CPF válido com ou sem pontuação", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita dígitos repetidos, tamanho e verificadores inválidos", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("normaliza caracteres não numéricos", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
  });
});
