import type { NextAuthConfig } from "next-auth";
import type { PharmacyType, Role, StaffProfile } from "@prisma/client";
import { hasVersionedSessionClaims } from "@/lib/session-claims";

// Config edge-safe (sem bcrypt/Prisma) — usada pelo middleware.
export const authConfig = {
  pages: { signIn: "/login" },
  // JWT curto reduz a janela residual em dispositivos esquecidos; sessionVersion
  // permite revogação imediata antes das 24 horas.
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.pharmacyId = user.pharmacyId ?? null;
        token.pharmacyType = user.pharmacyType ?? null;
        token.staffProfile = user.staffProfile ?? null;
        token.sessionVersion = user.sessionVersion;
        token.mfaEnabled = user.mfaEnabled;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.pharmacyId = (token.pharmacyId as string | null) ?? null;
        session.user.pharmacyType =
          (token.pharmacyType as PharmacyType | null) ?? null;
        session.user.staffProfile =
          (token.staffProfile as StaffProfile | null) ?? null;
        // Não fabrique defaults para JWTs legados: o proxy precisa distinguir
        // "claim ausente" de MFA desativado e forçar uma autenticação nova.
        if (hasVersionedSessionClaims(token)) {
          session.user.sessionVersion = token.sessionVersion;
          session.user.mfaEnabled = token.mfaEnabled;
        }
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;
      if (pathname.startsWith("/admin")) {
        return user?.role === "ADMIN";
      }
      if (pathname.startsWith("/conta") || pathname.startsWith("/checkout")) {
        return !!user;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
