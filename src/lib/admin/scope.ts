import { getAdminScope } from "@/lib/auth/session";

/**
 * Filtro efetivo de unidade para as queries do admin:
 *  - Filial: sempre a própria unidade (ignora a seleção da URL).
 *  - Matriz (global): a unidade selecionada, ou null = todas as unidades.
 */
export async function resolveUnitFilter(
  selectedUnitId?: string | null,
): Promise<string | null> {
  const scope = await getAdminScope();
  if (!scope.isGlobal) return scope.pharmacyId;
  return selectedUnitId ?? null;
}

export const ADMIN_PER_PAGE = 20;
