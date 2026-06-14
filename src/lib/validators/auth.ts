import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});

export const registerSchema = z
  .object({
    name: z.string().min(3, "Informe seu nome completo"),
    email: z.string().email("E-mail inválido"),
    cpf: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(v),
        "CPF inválido"
      ),
    phone: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(v),
        "Telefone inválido"
      ),
    password: z.string().min(8, "Mínimo de 8 caracteres"),
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
