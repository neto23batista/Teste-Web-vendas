import type { NextAuthConfig } from "next-auth";
import type { PharmacyType, Role, StaffProfile } from "@prisma/client";

// Config edge-safe (sem bcrypt/Prisma) — usada pelo middleware.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.pharmacyId = user.pharmacyId ?? null;
        token.pharmacyType = user.pharmacyType ?? null;
        token.staffProfile = user.staffProfile ?? null;
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
