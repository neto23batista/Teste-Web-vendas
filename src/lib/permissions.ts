import type { StaffProfile } from "@prisma/client";

/**
 * Controle de acesso por perfil dentro do painel. Todo staff é `role = ADMIN`;
 * o PERFIL define o que ele enxerga e opera.
 *
 * `staffProfile = null` (contas antigas, incluindo o admin inicial) é tratado
 * como OWNER — nenhuma conta perde acesso ao migrar.
 */
export type Area =
  | "dashboard"
  | "pedidos"
  | "entregas"
  | "receitas"
  | "clientes"
  | "avaliacoes"
  | "produtos"
  | "estoque"
  | "compras"
  | "cupons"
  | "assinaturas"
  | "relatorios"
  | "financeiro"
  | "integracao"
  | "equipe"
  | "auditoria"
  | "configuracoes";

/** Perfil efetivo: null (legado) = OWNER. */
export function effectiveProfile(p: StaffProfile | null | undefined): StaffProfile {
  return p ?? "OWNER";
}

/** Dono/gerente? `staffProfile = null` (legado) conta como OWNER. */
export function isOwnerProfile(p: StaffProfile | null | undefined): boolean {
  return effectiveProfile(p) === "OWNER";
}

/**
 * Áreas por perfil. OWNER não aparece aqui: tem acesso a tudo.
 * - PHARMACIST: cuida da validação farmacêutica e do atendimento clínico.
 * - STOCKIST: cuida de catálogo, estoque, compras e da integração com o PDV.
 * - ATTENDANT: cuida do balcão — pedidos, entregas e clientes.
 * Dinheiro (financeiro/relatórios), equipe, auditoria, cupons e configurações
 * ficam com o OWNER.
 */
const AREAS_BY_PROFILE: Record<Exclude<StaffProfile, "OWNER">, Area[]> = {
  PHARMACIST: ["dashboard", "pedidos", "receitas", "clientes", "assinaturas", "entregas"],
  STOCKIST: ["dashboard", "produtos", "estoque", "compras", "integracao"],
  ATTENDANT: ["dashboard", "pedidos", "entregas", "clientes"],
};

export function canAccess(
  profile: StaffProfile | null | undefined,
  area: Area
): boolean {
  const p = effectiveProfile(profile);
  if (p === "OWNER") return true;
  return AREAS_BY_PROFILE[p].includes(area);
}

/** Rótulos em pt-BR para o painel. */
export const PROFILE_LABEL: Record<StaffProfile, string> = {
  OWNER: "Dono / Gerente",
  PHARMACIST: "Farmacêutico(a)",
  STOCKIST: "Estoquista",
  ATTENDANT: "Atendente",
};

export const PROFILE_DESCRIPTION: Record<StaffProfile, string> = {
  OWNER: "Acesso total, incluindo financeiro, equipe e configurações.",
  PHARMACIST: "Receitas, pedidos, clientes e assinaturas.",
  STOCKIST: "Produtos, estoque, compras e integração com o PDV.",
  ATTENDANT: "Pedidos, entregas e clientes.",
};
