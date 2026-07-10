"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy } from "@/lib/session";
import { logAudit } from "@/lib/audit";

/**
 * Ajusta os níveis de reposição (mínimo/máximo) de um item de estoque.
 * O máximo é o alvo da sugestão de compra; vazio volta ao padrão (2× mínimo).
 */
export async function setStockLevels(
  inventoryId: string,
  minStock: number,
  maxStock: number | null
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("compras");

  if (!Number.isInteger(minStock) || minStock < 0) {
    return { ok: false, error: "Mínimo inválido." };
  }
  if (maxStock !== null && (!Number.isInteger(maxStock) || maxStock <= minStock)) {
    return { ok: false, error: "O máximo precisa ser maior que o mínimo." };
  }

  const inv = await prisma.inventory.findUnique({
    where: { id: inventoryId },
    select: { pharmacyId: true, product: { select: { name: true } } },
  });
  if (!inv) return { ok: false, error: "Item de estoque não encontrado." };
  await requireAdminAtPharmacy(inv.pharmacyId);

  await prisma.inventory.update({
    where: { id: inventoryId },
    data: { minStock, maxStock },
  });
  await logAudit({
    action: "stock.levels",
    entity: "Inventory",
    entityId: inventoryId,
    detail: `Níveis de ${inv.product.name}: mín ${minStock}, máx ${maxStock ?? "—"}`,
    pharmacyId: inv.pharmacyId,
  });
  revalidatePath("/admin/compras");
  revalidatePath("/admin/estoque");
  return { ok: true };
}
