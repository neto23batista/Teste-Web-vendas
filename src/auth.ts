import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createHash } from "node:crypto";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { mergeGuestCartIntoUser } from "@/lib/cart-merge";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { verifyMfaChallenge } from "@/lib/mfa-challenge";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  mfaCode: z.string().max(64).optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    // Ao logar, mescla o carrinho-convidado no carrinho do usuário.
    async signIn({ user }) {
      if (user?.id) {
        try {
          await mergeGuestCartIntoUser(user.id);
        } catch {
          // merge é best-effort; não bloqueia o login.
        }
      }
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        mfaCode: { label: "Código de autenticação", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Este é o ponto real de autenticação, alcançável também pelo
        // callback HTTP do Auth.js. Limitar apenas a Server Action da tela de
        // login deixaria esse endpoint direto livre para brute force.
        const email = parsed.data.email.toLowerCase();
        const ip = clientIpFromHeaders(request.headers);
        const identityKey = createHash("sha256")
          .update(`${ip}\0${email}`)
          .digest("hex")
          .slice(0, 32);
        const identityLimit = await rateLimit(
          `auth:credentials:${identityKey}`,
          5,
          60_000
        );
        if (!identityLimit.ok) return null;

        // Um segundo teto reduz credential stuffing com muitos e-mails. Quando
        // não há proxy confiável, não use o bucket global "unknown".
        if (ip !== "unknown") {
          const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 24);
          if (!(await rateLimit(`auth:credentials:ip:${ipKey}`, 30, 60_000)).ok) {
            return null;
          }
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            staffProfile: true,
            pharmacyId: true,
            sessionVersion: true,
            mfaSecretEncrypted: true,
            mfaEnabledAt: true,
            pharmacy: { select: { type: true } },
          },
        });
        const valid = await verifyPassword(
          parsed.data.password,
          user?.passwordHash ?? DUMMY_PASSWORD_HASH
        );
        if (!user || !valid) return null;
        if (
          user.mfaEnabledAt &&
          !(await verifyMfaChallenge(user, parsed.data.mfaCode ?? ""))
        ) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          pharmacyId: user.pharmacyId,
          pharmacyType: user.pharmacy?.type ?? null,
          staffProfile: user.staffProfile,
          sessionVersion: user.sessionVersion,
          mfaEnabled: Boolean(user.mfaEnabledAt),
        };
      },
    }),
  ],
});
