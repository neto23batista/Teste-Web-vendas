import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccess, type Area } from "@/lib/permissions";

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

/**
 * Guard de PÁGINA por área do painel: quem não tem o perfil certo é levado ao
 * dashboard (que todo staff enxerga) em vez de ver um erro. Server Actions
 * usam `assertArea`, que lança — ali um redirect não faria sentido.
 */
export async function requireArea(area: Area) {
  const user = await requireAdmin();
  if (!canAccess(user.staffProfile, area)) redirect("/admin");
  return user;
}

/** Guard de SERVER ACTION por área — lança quando o perfil não permite. */
export async function assertArea(area: Area) {
  const user = await requireAdmin();
  if (!canAccess(user.staffProfile, area)) {
    throw new Error("Seu perfil não permite esta ação.");
  }
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
