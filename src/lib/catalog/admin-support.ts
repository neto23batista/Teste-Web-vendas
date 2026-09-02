import { revalidatePath, revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { type UnitOfferInput } from "@/lib/catalog/product-form";
import { syncCatalogInventory } from "@/lib/inventory/catalog-stock";
import type { InventoryMovementActor } from "@/lib/inventory/movements";

// Invalida o cache das listas de produto da home (tag "products").
export function revalidateProducts() {
  revalidateTag("products", "max");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

// Catálogo e preços são compartilhados (globais) → só a matriz gerencia. Além do
// escopo (matriz), exige a ÁREA "produtos": o middleware protege a página, mas as
// Server Actions são invocáveis direto pelo id — sem esta checagem, um admin da
// matriz com perfil que não é de catálogo (farmacêutico/atendente) conseguiria
// criar/editar/excluir/importar produtos chamando a action na mão.
export async function isCatalogAdmin(): Promise<boolean> {
  const user = await requireAdmin();
  return (
    user.pharmacyType === "MATRIZ" && canAccess(user.staffProfile, "produtos")
  );
}

/** Cria somente ofertas ausentes; preserva o saldo das unidades existentes. */
export async function ensureInventoryForAllUnits(
  tx: Prisma.TransactionClient,
  productId: string,
  minStock: number,
  offer: UnitOfferInput,
) {
  const pharmacies = await tx.pharmacy.findMany({
    where: { active: true, archivedAt: null },
    select: { id: true },
  });
  for (const ph of pharmacies) {
    await tx.inventory.upsert({
      where: { productId_pharmacyId: { productId, pharmacyId: ph.id } },
      create: { productId, pharmacyId: ph.id, stock: 0, minStock, ...offer },
      update: {},
    });
  }
}

/** Oferta da matriz; saldo só é informado na criação ou na contagem CSV. */
export async function syncMatrizOffer(
  tx: Prisma.TransactionClient,
  productId: string,
  minStock: number,
  offer: UnitOfferInput,
  actor: InventoryMovementActor,
  stock?: number,
) {
  const matriz = await tx.pharmacy.findFirst({
    where: { type: "MATRIZ", active: true, archivedAt: null },
    select: { id: true },
  });
  if (!matriz) return;
  await syncCatalogInventory(tx, {
    productId,
    pharmacyId: matriz.id,
    stock,
    minStock,
    offer,
    actor,
    reason: "Estoque inicial ou contagem pela gestão de catálogo",
  });
}
