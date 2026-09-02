import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccess, isOwnerProfile, type Area } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isLiveProduction } from "@/lib/env";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";
import { hasVersionedSessionClaims } from "@/lib/auth/session-claims";

/**
 * Sessão do request atual, memoizada com o `cache` do React.
 *
 * `auth()` não é barato: relê os cookies, remonta um Request sintético e roda o
 * decrypt do JWT + o callback de sessão. Sem memoizar, uma única Server Action
 * de admin resolvia a sessão DUAS vezes (o portão de área e o de escopo pedem
 * cada um o seu), e telas como o /admin também. O `cache` dedupa por request:
 * a 1ª chamada resolve, as demais reaproveitam. Vale para todos os guards
 * abaixo — e para os que vierem — sem ninguém precisar passar o user na mão.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !hasVersionedSessionClaims(user)) {
    return null;
  }

  // O JWT identifica a conta, mas a versão persistida decide se ele ainda é
  // válido. Troca/reset de senha, MFA e mudanças de acesso incrementam esse
  // valor e revogam imediatamente todos os cookies anteriores.
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { sessionVersion: true },
  });
  if (!current || current.sessionVersion !== user.sessionVersion) return null;
  return user;
});

/**
 * Identidade administrativa revalidada no banco uma vez por request.
 *
 * O JWT continua sendo suficiente para identificar a conta, mas claims de
 * autorização podem ficar antigos. Papel, perfil e unidade abaixo sempre vêm
 * do banco; conta revogada, unidade removida/inativa ou sem unidade falha
 * fechado. A versão persistente validada acima também revoga imediatamente
 * cookies emitidos antes de uma alteração de segurança ou acesso.
 */
const getVerifiedAdmin = cache(async () => {
  const sessionUser = await getCurrentUser();
  if (!sessionUser?.id) return null;

  const current = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      role: true,
      staffProfile: true,
      pharmacyId: true,
      mfaEnabledAt: true,
      pharmacy: { select: { type: true, active: true, archivedAt: true } },
    },
  });
  if (
    !current ||
    current.role !== "ADMIN" ||
    !current.pharmacyId ||
    !current.pharmacy?.active ||
    Boolean(current.pharmacy.archivedAt) ||
    (isLiveProduction() && !current.mfaEnabledAt)
  ) {
    return null;
  }

  return {
    ...sessionUser,
    role: current.role,
    staffProfile: current.staffProfile,
    pharmacyId: current.pharmacyId,
    pharmacyType: current.pharmacy.type,
    mfaEnabled: Boolean(current.mfaEnabledAt),
  };
});

/**
 * Permite ao layout distinguir "admin sem MFA" de uma conta sem permissão e
 * direcioná-la para o enrollment. Operações administrativas continuam usando
 * `requireAdmin`, que falha fechado enquanto a ativação não terminar.
 */
export const adminNeedsMfaEnrollment = cache(async () => {
  if (!isLiveProduction()) return false;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return false;
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      mfaEnabledAt: true,
      pharmacy: { select: { active: true, archivedAt: true } },
    },
  });
  return Boolean(
    current?.role === "ADMIN" &&
      current.pharmacy?.active &&
      !current.pharmacy.archivedAt &&
      !current.mfaEnabledAt
  );
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}

/**
 * Guard exclusivo de páginas: uma sessão ausente, legada ou revogada volta ao
 * login em vez de cair no error boundary do RSC. Ações e APIs devem continuar
 * usando `requireUser()`, que falha fechado sem transformar erros em redirects.
 */
export async function requireUserPage(callbackUrl: unknown) {
  const user = await getCurrentUser();
  if (!user) {
    const safeCallbackUrl = safeInternalRedirect(callbackUrl) ?? "/conta";
    redirect(`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`);
  }
  return user;
}

export async function requireAdmin() {
  const user = await getVerifiedAdmin();
  if (!user) throw new Error("Acesso negado");
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

/**
 * Guard de ações restritas ao DONO/GERENTE (OWNER) — ações destrutivas e
 * irreversíveis, como excluir um pedido definitivamente. O perfil OWNER deve
 * estar explicitamente persistido; valor ausente falha sem elevar privilégios.
 */
export async function assertOwner() {
  const user = await requireAdmin();
  if (!isOwnerProfile(user.staffProfile)) {
    throw new Error("Apenas o dono/gerente pode executar esta ação.");
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
/**
 * Valida o escopo inclusive para registros legados sem unidade. A matriz pode
 * tratar esses registros para saneamento; uma filial falha fechado em `null`,
 * em vez de ganhar acesso porque o chamador pulou o guard condicionalmente.
 */
export async function requireAdminAtPharmacy(pharmacyId: string | null) {
  const user = await requireAdmin();
  if (user.pharmacyType === "MATRIZ") return user;
  if (user.pharmacyId && user.pharmacyId === pharmacyId) return user;
  throw new Error("Acesso negado a esta unidade");
}
