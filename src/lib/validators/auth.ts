import { z } from "zod";
import { isValidCpf } from "@/lib/cpf";

export const loginSchema = z.object({
  email: z.string().max(254).email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(128, "Senha inválida"),
  mfaCode: z.string().trim().max(64, "Código inválido").optional(),
});

// CPF/telefone: normaliza ANTES de validar (aceita qualquer pontuação/espaços
// que pessoas reais digitam — "11 9 8765-4321", "(11)98765.4321"…) e valida só
// a quantidade de dígitos. O valor validado sai normalizado (apenas dígitos).
const digits = (v: string | undefined) => (v ? v.replace(/\D/g, "") : v);

export const registerSchema = z
  .object({
    name: z.string().min(3, "Informe seu nome completo").max(120, "Nome muito longo"),
    email: z.string().max(254).email("E-mail inválido"),
    cpf: z
      .string()
      .optional()
      .transform(digits)
      .refine((v) => !v || isValidCpf(v), "CPF inválido — confira os dígitos"),
    phone: z
      .string()
      .optional()
      .transform(digits)
      .refine(
        (v) => !v || v.length === 10 || v.length === 11,
        "Telefone inválido — use DDD + número"
      ),
    password: z
      .string()
      .min(12, "A senha precisa de pelo menos 12 caracteres")
      .max(64, "A senha pode ter no máximo 64 caracteres"),
    confirm: z.string().min(12, "Confirme a senha").max(64, "Senha muito longa"),
    lgpd: z.literal("on", { message: "É necessário aceitar a política" }).or(z.boolean()),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

export const resetRequestSchema = z.object({
  email: z.string().max(254).email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/i, "Token inválido"),
    password: z.string().min(12, "Mínimo de 12 caracteres").max(64, "Senha muito longa"),
    confirm: z.string().min(12, "Confirme a senha").max(64, "Senha muito longa"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });
