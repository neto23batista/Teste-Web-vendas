import "server-only";

import { prisma } from "@/lib/prisma";
import { getAdminScope, requireArea } from "@/lib/auth/session";
import { getStockRows } from "@/lib/admin";
import { getPurchaseSuggestions } from "@/lib/admin/reports";
import { inventoryLotDateCutoff } from "@/lib/inventory/lots";

/** Unidade e permissão são resolvidas antes de consultar movimentos/transferências. */
export async function getAdminStockView(selectedUnitId?: string) {
  await requireArea("estoque");
  const [{ unitId, rows }, scope] = await Promise.all([
    getStockRows(selectedUnitId),
    getAdminScope(),
  ]);
  const lowCount = rows.filter((p) => p.stock <= p.minStock).length;

  // Transferência entre unidades é exclusiva da matriz. Carrega as unidades e o
  // estoque de cada produto por unidade (para mostrar de/para onde mover).
  const canTransfer = scope.isGlobal && !!unitId;
  let units: { id: string; name: string }[] = [];
  const stockByProduct: Record<string, Record<string, number>> = {};
  if (canTransfer && rows.length > 0) {
    const [unitList, invs] = await Promise.all([
      prisma.pharmacy.findMany({
        where: { active: true, archivedAt: null },
        select: { id: true, name: true },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      prisma.inventory.findMany({
        where: { productId: { in: rows.map((r) => r.productId) } },
        select: { productId: true, pharmacyId: true, stock: true },
      }),
    ]);
    units = unitList;
    for (const iv of invs) {
      (stockByProduct[iv.productId] ??= {})[iv.pharmacyId] = iv.stock;
    }
  }
  const showTransfer = canTransfer && units.length > 1;
  const movements = unitId
    ? await prisma.inventoryMovement.findMany({
        where: { pharmacyId: unitId },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];
  const movementProducts = movements.length
    ? await prisma.product.findMany({
        where: { id: { in: [...new Set(movements.map((movement) => movement.productId))] } },
        select: { id: true, name: true },
      })
    : [];
  const productNames = new Map(movementProducts.map((product) => [product.id, product.name]));

  return { unitId, rows, lowCount, units, stockByProduct, showTransfer,
    movements: movements.map((movement) => ({
      id: movement.id, createdAt: movement.createdAt,
      productName: productNames.get(movement.productId) ?? movement.productId,
      kind: movement.kind, delta: movement.delta,
      stockBefore: movement.stockBefore, stockAfter: movement.stockAfter,
      reason: movement.reason, actorEmail: movement.actorEmail,
    })),
  };
}

async function getInventoryLotsWithExpiry(pharmacyId: string) {
  const lots = await prisma.inventoryLot.findMany({
    where: { pharmacyId, qty: { gt: 0 } },
    include: { product: { select: { name: true } } },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "desc" }],
    take: 100,
  });
  const today = inventoryLotDateCutoff().getTime();
  return lots.map((lot) => ({
    ...lot,
    daysToExpiry: Math.floor((lot.expiresAt.getTime() - today) / 86_400_000),
  }));
}

export async function getAdminPurchasesView(selectedUnitId?: string) {
  await requireArea("compras");
  const { unitId, rows } = await getPurchaseSuggestions(selectedUnitId);
  const lots = unitId
    ? await getInventoryLotsWithExpiry(unitId)
    : [];

  const toBuy = rows.filter((r) => r.suggested > 0);
  const estimated = toBuy.reduce(
    (s, r) => s + (r.costPrice ?? 0) * r.suggested,
    0
  );
  const missingCost = toBuy.some((r) => r.costPrice == null);

  return { unitId, rows, lots, toBuy, estimated, missingCost };
}
