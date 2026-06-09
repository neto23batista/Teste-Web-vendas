"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registerSchema } from "@/lib/validators/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail, baseUrl } from "@/lib/mail";
import { welcomeEmail } from "@/lib/email-templates";

export type AuthState = { error?: string } | undefined;

const TOO_MANY = "Muitas tentativas. Aguarde um instante e tente novamente.";

export async function authenticate(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Preencha e-mail e senha corretamente." };

  // Limita tentativas de login por IP+e-mail (anti brute force).
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}:${parsed.data.email.toLowerCase()}`, 5, 60_000).ok) {
    return { error: TOO_MANY };
  }

  // Direciona admins ao painel e clientes à conta
  const target = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { role: true },
  });
  const redirectTo = target?.role === "ADMIN" ? "/admin" : "/conta";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: "E-mail ou senha incorretos." };
    throw err; // redirect
  }
  return undefined;
}

export async function register(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Limita cadastros por IP (anti-abuso).
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 60_000).ok) {
    return { error: TOO_MANY };
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Este e-mail já está cadastrado." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      cpf: parsed.data.cpf || null,
      phone: parsed.data.phone || null,
      role: "CUSTOMER",
      loyalty: { create: { points: 0 } },
    },
  });

  // E-mail de boas-vindas (best-effort — não bloqueia o cadastro).
  const w = welcomeEmail(parsed.data.name, `${baseUrl()}/catalogo`);
  await sendMail({ to: email, subject: w.subject, html: w.html });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/conta",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Conta criada! Faça login para continuar." };
    }
    throw err;
  }
  return undefined;
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
