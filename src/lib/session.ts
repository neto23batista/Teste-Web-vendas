import { auth } from "@/auth";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("Acesso negado");
  return user;
}

/** Escopo de unidade de um admin. Matriz = global (vê todas); filial = só a sua. */
export type AdminScope = {
  isGlobal: boolean;
  /** Unidade do próprio admin (null se não vinculado). */
  pharmacyId: string | null;
};

export async function getAdminScope(): Promise<AdminScope> {
  const user = await requireAdmin();
  return {
    isGlobal: user.pharmacyType === "MATRIZ",
    pharmacyId: user.pharmacyId ?? null,
  };
}

/**
 * Garante que o admin pode agir sobre uma unidade específica.
 * Matriz age em qualquer unidade; filial só na própria.
 */
export async function requireAdminAtPharmacy(pharmacyId: string) {
  const user = await requireAdmin();
  if (user.pharmacyType === "MATRIZ") return user;
  if (user.pharmacyId && user.pharmacyId === pharmacyId) return user;
  throw new Error("Acesso negado a esta unidade");
}
