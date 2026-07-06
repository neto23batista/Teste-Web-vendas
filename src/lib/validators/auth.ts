import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});

// CPF/telefone: normaliza ANTES de validar (aceita qualquer pontuação/espaços
// que pessoas reais digitam — "11 9 8765-4321", "(11)98765.4321"…) e valida só
// a quantidade de dígitos. O valor validado sai normalizado (apenas dígitos).
const digits = (v: string | undefined) => (v ? v.replace(/\D/g, "") : v);

export const registerSchema = z
  .object({
    name: z.string().min(3, "Informe seu nome completo"),
    email: z.string().email("E-mail inválido"),
    cpf: z
      .string()
      .optional()
      .transform(digits)
      .refine((v) => !v || v.length === 11, "CPF inválido — confira os 11 dígitos"),
    phone: z
      .string()
      .optional()
      .transform(digits)
      .refine(
        (v) => !v || v.length === 10 || v.length === 11,
        "Telefone inválido — use DDD + número"
      ),
    password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres"),
    confirm: z.string().min(8, "Confirme a senha"),
    lgpd: z.literal("on", { message: "É necessário aceitar a política" }).or(z.boolean()),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

export const resetRequestSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Token inválido"),
    password: z.string().min(8, "Mínimo de 8 caracteres"),
    confirm: z.string().min(8, "Confirme a senha"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });
