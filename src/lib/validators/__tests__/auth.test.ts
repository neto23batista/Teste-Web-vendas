import { describe, it, expect } from "vitest";
import { registerSchema, resetPasswordSchema } from "@/lib/validators/auth";

const baseRegister = {
  name: "Maria Silva",
  email: "maria@exemplo.com",
  password: "12345678",
  confirm: "12345678",
  lgpd: "on",
};

describe("registerSchema", () => {
  it("aceita dados válidos", () => {
    expect(registerSchema.safeParse(baseRegister).success).toBe(true);
  });
  it("rejeita senha com menos de 8 caracteres", () => {
    const r = registerSchema.safeParse({
      ...baseRegister,
      password: "123",
      confirm: "123",
    });
    expect(r.success).toBe(false);
  });
  it("rejeita confirmação diferente", () => {
    const r = registerSchema.safeParse({ ...baseRegister, confirm: "87654321" });
    expect(r.success).toBe(false);
  });
  it("rejeita CPF malformado", () => {
    const r = registerSchema.safeParse({ ...baseRegister, cpf: "123" });
    expect(r.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("exige token e senhas iguais", () => {
    const r = resetPasswordSchema.safeParse({
      token: "0123456789abcdef",
      password: "12345678",
      confirm: "12345678",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita confirmação diferente", () => {
    const r = resetPasswordSchema.safeParse({
      token: "0123456789abcdef",
      password: "12345678",
      confirm: "diferente",
    });
    expect(r.success).toBe(false);
  });
});
