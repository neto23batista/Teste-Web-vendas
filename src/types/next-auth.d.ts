import type { PharmacyType, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    // Unidade do admin (null em clientes). MATRIZ = escopo global.
    pharmacyId?: string | null;
    pharmacyType?: PharmacyType | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      pharmacyId: string | null;
      pharmacyType: PharmacyType | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    pharmacyId: string | null;
    pharmacyType: PharmacyType | null;
  }
}
