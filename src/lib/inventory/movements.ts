import type {
  InventoryMovementKind,
  Prisma,
} from "@prisma/client";

type InventoryWriter = Pick<
  Prisma.TransactionClient,
  "inventory" | "inventoryMovement"
>;

export type InventoryMovementActor = {
  id?: string | null;
  email?: string | null;
} | null;

export type ChangeInventoryInput = {
  productId: string;
  pharmacyId: string;
  delta: number;
  kind: InventoryMovementKind;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  actor?: InventoryMovementActor;
};

export class InsufficientInventoryError extends Error {}

/**
 * Altera o saldo com uma operação atômica e grava o livro razão na mesma
 * transação. `stockBefore` é derivado do saldo retornado pelo próprio UPDATE /
 * UPSERT, portanto duas requisições concorrentes não sobrescrevem uma à outra.
 */
export async function changeInventory(
  tx: InventoryWriter,
  input: ChangeInventoryInput
): Promise<{ inventoryId: string; stockBefore: number; stockAfter: number }> {
  if (!Number.isSafeInteger(input.delta) || input.delta === 0) {
    throw new Error("Movimento de estoque inválido.");
  }
  const reason = input.reason.trim().slice(0, 500);
  if (!reason) throw new Error("Informe o motivo do movimento de estoque.");

  let inventory: { id: string; stock: number } | null = null;
  if (input.delta > 0) {
    inventory = await tx.inventory.upsert({
      where: {
        productId_pharmacyId: {
          productId: input.productId,
          pharmacyId: input.pharmacyId,
        },
      },
      create: {
        productId: input.productId,
        pharmacyId: input.pharmacyId,
        stock: input.delta,
        minStock: 5,
      },
      update: { stock: { increment: input.delta } },
      select: { id: true, stock: true },
    });
  } else {
    const quantity = Math.abs(input.delta);
    const changed = await tx.inventory.updateMany({
      where: {
        productId: input.productId,
        pharmacyId: input.pharmacyId,
        stock: { gte: quantity },
      },
      data: { stock: { decrement: quantity } },
    });
    if (changed.count !== 1) {
      throw new InsufficientInventoryError("Estoque insuficiente para esta saída.");
    }
    inventory = await tx.inventory.findUnique({
      where: {
        productId_pharmacyId: {
          productId: input.productId,
          pharmacyId: input.pharmacyId,
        },
      },
      select: { id: true, stock: true },
    });
  }

  if (!inventory || !Number.isSafeInteger(inventory.stock) || inventory.stock < 0) {
    throw new Error("Saldo de estoque inconsistente após o movimento.");
  }
  const stockAfter = inventory.stock;
  const stockBefore = stockAfter - input.delta;

  await tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      pharmacyId: input.pharmacyId,
      kind: input.kind,
      delta: input.delta,
      stockBefore,
      stockAfter,
      reason,
      referenceType: input.referenceType?.trim().slice(0, 80) || null,
      referenceId: input.referenceId?.trim().slice(0, 191) || null,
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
    },
  });

  return { inventoryId: inventory.id, stockBefore, stockAfter };
}
