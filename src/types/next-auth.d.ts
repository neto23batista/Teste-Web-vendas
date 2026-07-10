import type { PharmacyType, Role, StaffProfile } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    // Unidade do admin (null em clientes). MATRIZ = escopo global.
    pharmacyId?: string | null;
    pharmacyType?: PharmacyType | null;
    // Perfil operacional do staff (null = OWNER, acesso total).
    staffProfile?: StaffProfile | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      pharmacyId: string | null;
      pharmacyType: PharmacyType | null;
      staffProfile: StaffProfile | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    pharmacyId: string | null;
    pharmacyType: PharmacyType | null;
    staffProfile: StaffProfile | null;
  }
}
