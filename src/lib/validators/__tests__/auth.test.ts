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
  it("aceita telefone em QUALQUER formatação real e normaliza para dígitos", () => {
    for (const phone of ["11 9 8765-4321", "(11)98765.4321", "(11) 4004-1234", "11987654321"]) {
      const r = registerSchema.safeParse({ ...baseRegister, phone });
      expect(r.success, `telefone ${phone}`).toBe(true);
      if (r.success) expect(r.data.phone).toMatch(/^\d{10,11}$/);
    }
  });
  it("aceita CPF com ou sem pontuação e normaliza", () => {
    for (const cpf of ["529.982.247-25", "52998224725", "529 982 247 25"]) {
      const r = registerSchema.safeParse({ ...baseRegister, cpf });
      expect(r.success, `cpf ${cpf}`).toBe(true);
      if (r.success) expect(r.data.cpf).toBe("52998224725");
    }
  });
  it("campos vazios de CPF/telefone continuam opcionais", () => {
    const r = registerSchema.safeParse({ ...baseRegister, cpf: "", phone: "" });
    expect(r.success).toBe(true);
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
