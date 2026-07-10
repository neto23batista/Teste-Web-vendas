import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { mergeGuestCartIntoUser } from "@/lib/cart-merge";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { pharmacy: { select: { type: true } } },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          pharmacyId: user.pharmacyId,
          pharmacyType: user.pharmacy?.type ?? null,
          staffProfile: user.staffProfile,
        };
      },
    }),
  ],
});
