"use server";

import { AuthError } from "next-auth";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registerSchema } from "@/lib/auth/validators";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { sendMail, baseUrl } from "@/lib/communications/mail";
import { welcomeEmail } from "@/lib/communications/email-templates";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { isLiveProduction } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";

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
  const loginIdentity = createHash("sha256")
    .update(`${ip}\0${parsed.data.email.toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
  if (!(await rateLimit(`login:${loginIdentity}`, 5, 60_000, { critical: true })).ok) {
    return { error: TOO_MANY };
  }

  // Direciona admins ao painel e clientes à conta
  const target = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { role: true, mfaEnabledAt: true },
  });
  const needsMfaEnrollment =
    target?.role === "ADMIN" &&
    !target.mfaEnabledAt &&
    isLiveProduction();
  const fallback = target?.role === "ADMIN" ? "/admin" : "/conta";
  const redirectTo = needsMfaEnrollment
    ? "/conta/seguranca?required=1"
    : safeInternalRedirect(formData.get("callbackUrl")) ?? fallback;

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      mfaCode: parsed.data.mfaCode ?? "",
      redirectTo,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Dados de acesso ou código de autenticação incorretos." };
    }
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
  if (
    formData.get("lgpd") !== "on" ||
    formData.get("privacyVersion") !== PRIVACY_VERSION ||
    formData.get("termsVersion") !== TERMS_VERSION
  ) {
    return {
      error: "Aceite os Termos e confirme ciência da Política de Privacidade atuais.",
    };
  }

  // Limita cadastros por IP (anti-abuso).
  const ip = await clientIp();
  if (!(await rateLimit(`register:${ip}`, 5, 60_000, { critical: true })).ok) {
    return { error: TOO_MANY };
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Este e-mail já está cadastrado." };

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        cpf: parsed.data.cpf || null,
        phone: parsed.data.phone || null,
        role: "CUSTOMER",
        loyalty: { create: { points: 0 } },
        // A escrita aninhada é atômica com a criação da conta: nunca
        // existe usuário criado pelo formulário sem a evidência versionada.
        policyAcceptances: {
          create: [
            { kind: "TERMS_ACCEPTANCE", version: TERMS_VERSION },
            {
              kind: "PRIVACY_ACKNOWLEDGEMENT",
              version: PRIVACY_VERSION,
            },
          ],
        },
      },
    });
  } catch (error) {
    // O precheck melhora a UX, mas só a constraint protege duas requisições
    // concorrentes (e também o CPF parcial/lower(email) das migrations).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        error:
          "Não foi possível cadastrar estes dados. Confira se e-mail ou CPF já estão em uso.",
      };
    }
    throw error;
  }

  // E-mail de boas-vindas (best-effort — não bloqueia o cadastro).
  const w = welcomeEmail(parsed.data.name, `${baseUrl()}/catalogo`);
  await sendMail({ to: email, subject: w.subject, html: w.html });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      mfaCode: "",
      redirectTo:
        safeInternalRedirect(formData.get("callbackUrl")) ?? "/conta",
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
