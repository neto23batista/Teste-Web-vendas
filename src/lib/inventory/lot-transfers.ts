import type { Prisma } from "@prisma/client";
import { changeInventory, InsufficientInventoryError, type InventoryMovementActor } from "@/lib/inventory/movements";
import { inventoryLotAvailability, InventoryLotBalanceError } from "@/lib/inventory/lots";

/** Move estoque físico e seus lotes na transação iniciada pela ação administrativa. */
export async function transferPhysicalInventory(
  tx: Prisma.TransactionClient,
  input: {
    productId: string;
    fromPharmacyId: string;
    toPharmacyId: string;
    qty: number;
    transferId: string;
    actor: InventoryMovementActor;
  }
) {
  const { productId, fromPharmacyId, toPharmacyId, qty, transferId, actor } = input;
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 100_000 || fromPharmacyId === toPharmacyId) {
    throw new InventoryLotBalanceError("Informe unidades diferentes e uma quantidade inteira entre 1 e 100.000.");
  }
  const units = await tx.pharmacy.findMany({
    where: { id: { in: [fromPharmacyId, toPharmacyId] }, active: true, archivedAt: null },
    select: { id: true },
  });
  if (units.length !== 2) throw new InventoryLotBalanceError("A origem e o destino precisam ser unidades ativas.");

  await tx.inventory.createMany({
    data: [{ productId, pharmacyId: toPharmacyId, stock: 0, minStock: 5 }],
    skipDuplicates: true,
  });
  // Trava as duas unidades na mesma ordem mesmo em transferências inversas.
  const stocks = await tx.$queryRaw<{ pharmacyId: string; stock: number }[]>`
    SELECT "pharmacyId", "stock" FROM "Inventory"
    WHERE "productId" = ${productId} AND "pharmacyId" IN (${fromPharmacyId}, ${toPharmacyId})
    ORDER BY "pharmacyId" FOR UPDATE
  `;
  const source = stocks.find((stock) => stock.pharmacyId === fromPharmacyId);
  if (!source || source.stock < qty) throw new InsufficientInventoryError("Estoque insuficiente na unidade de origem.");

  const lots = await tx.inventoryLot.findMany({
    where: { productId, pharmacyId: fromPharmacyId, qty: { gt: 0 } },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
  });
  const { dateCutoff, availableStock } = inventoryLotAvailability(source.stock, lots);
  if (qty > availableStock) {
    throw new InventoryLotBalanceError("Estoque válido insuficiente: há unidades em lotes vencidos.");
  }

  await changeInventory(tx, {
    productId, pharmacyId: fromPharmacyId, delta: -qty, kind: "TRANSFER_OUT",
    reason: `Transferência para a unidade ${toPharmacyId}`,
    referenceType: "STOCK_TRANSFER", referenceId: transferId, actor,
  });
  await changeInventory(tx, {
    productId, pharmacyId: toPharmacyId, delta: qty, kind: "TRANSFER_IN",
    reason: `Transferência recebida da unidade ${fromPharmacyId}`,
    referenceType: "STOCK_TRANSFER", referenceId: transferId, actor,
  });

  let remaining = qty;
  for (const lot of lots) {
    if (remaining === 0) break;
    if (lot.expiresAt < dateCutoff) continue;
    const moved = Math.min(remaining, lot.qty);
    const destinationKey = { productId, pharmacyId: toPharmacyId, lotCode: lot.lotCode };
    const destination = await tx.inventoryLot.findUnique({
      where: { productId_pharmacyId_lotCode: destinationKey },
      select: { expiresAt: true },
    });
    if (destination && destination.expiresAt.toISOString().slice(0, 10) !== lot.expiresAt.toISOString().slice(0, 10)) {
      throw new InventoryLotBalanceError(`O lote ${lot.lotCode} possui outra validade na unidade de destino.`);
    }
    const changed = await tx.inventoryLot.updateMany({
      where: { id: lot.id, qty: { gte: moved } },
      data: { qty: { decrement: moved } },
    });
    if (changed.count !== 1) throw new InventoryLotBalanceError("O saldo do lote mudou. Atualize e tente novamente.");
    await tx.inventoryLot.upsert({
      where: { productId_pharmacyId_lotCode: destinationKey },
      create: {
        ...destinationKey, expiresAt: lot.expiresAt, qty: moved,
        supplier: lot.supplier, note: lot.note, receivedAt: lot.receivedAt,
      },
      update: { qty: { increment: moved } },
    });
    remaining -= moved;
  }
  // A parcela restante corresponde apenas ao saldo legado, realmente sem lote.
}
