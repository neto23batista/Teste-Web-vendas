import type { Prisma } from "@prisma/client";
import type { UnitOfferInput } from "@/lib/catalog/product-form";
import { changeInventory, type InventoryMovementActor } from "./movements";
import { InventoryLotBalanceError } from "./lots";

type CatalogInventoryInput = {
  productId: string;
  pharmacyId: string;
  minStock: number;
  offer: UnitOfferInput;
  /** Ausente: atualiza somente a oferta, sem regravar o saldo exibido no formulário. */
  stock?: number;
  reason: string;
  actor?: InventoryMovementActor;
};

/** Atualização de oferta/contagem protegida pelo lock do próprio UPSERT. */
export async function syncCatalogInventory(
  tx: Prisma.TransactionClient,
  input: CatalogInventoryInput,
) {
  if (
    !Number.isSafeInteger(input.minStock) ||
    input.minStock < 0 ||
    input.minStock > 2_147_483_647
  ) {
    throw new InventoryLotBalanceError("Estoque mínimo inválido.");
  }
  if (
    input.stock !== undefined &&
    (!Number.isSafeInteger(input.stock) ||
      input.stock < 0 ||
      input.stock > 2_147_483_647)
  ) {
    throw new InventoryLotBalanceError("Contagem de estoque inválida.");
  }
  // O UPDATE bloqueia a linha antes da leitura dos lotes, na mesma ordem usada
  // por recebimentos, baixas, reservas e transferências. Não altera o saldo.
  const inventory = await tx.inventory.upsert({
    where: {
      productId_pharmacyId: {
        productId: input.productId,
        pharmacyId: input.pharmacyId,
      },
    },
    create: {
      productId: input.productId,
      pharmacyId: input.pharmacyId,
      stock: 0,
      minStock: input.minStock,
      ...input.offer,
    },
    update: { minStock: input.minStock, ...input.offer },
    select: { id: true, stock: true },
  });
  if (input.stock === undefined || input.stock === inventory.stock)
    return inventory;

  const lots = await tx.inventoryLot.aggregate({
    where: { productId: input.productId, pharmacyId: input.pharmacyId },
    _sum: { qty: true },
  });
  if ((lots._sum.qty ?? 0) > input.stock) {
    throw new InventoryLotBalanceError(
      "A contagem reduziria estoque rastreado. Registre a baixa no lote em Compras.",
    );
  }
  await changeInventory(tx, {
    productId: input.productId,
    pharmacyId: input.pharmacyId,
    delta: input.stock - inventory.stock,
    kind: "MANUAL_ADJUSTMENT",
    reason: input.reason,
    referenceType: "CATALOG_STOCK",
    referenceId: input.productId,
    actor: input.actor,
  });
  return { id: inventory.id, stock: input.stock };
}

/** Livro razão inicial para produtos novos inseridos em lote, sem consultas por item. */
export async function recordInitialCatalogStock(
  tx: Prisma.TransactionClient,
  inventories: ReadonlyArray<{
    productId: string;
    pharmacyId: string;
    stock: number;
  }>,
  actor: InventoryMovementActor,
) {
  if (
    inventories.some(
      (inventory) =>
        !Number.isSafeInteger(inventory.stock) ||
        inventory.stock < 0 ||
        inventory.stock > 2_147_483_647,
    )
  ) {
    throw new InventoryLotBalanceError("Estoque inicial inválido.");
  }
  const rows = inventories.filter((inventory) => inventory.stock > 0);
  if (!rows.length) return;
  await tx.inventoryMovement.createMany({
    data: rows.map((inventory) => ({
      productId: inventory.productId,
      pharmacyId: inventory.pharmacyId,
      kind: "MANUAL_ADJUSTMENT" as const,
      delta: inventory.stock,
      stockBefore: 0,
      stockAfter: inventory.stock,
      reason: "Estoque inicial pela importação de catálogo",
      referenceType: "CATALOG_IMPORT",
      referenceId: inventory.productId,
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
    })),
  });
}
