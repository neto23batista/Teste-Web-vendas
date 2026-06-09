import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
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
