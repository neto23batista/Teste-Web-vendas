"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy } from "@/lib/session";
import { changeInventory, InsufficientInventoryError } from "@/lib/inventory-movements";
import { logAuditInTransaction } from "@/lib/audit";

export type LotActionResult = { ok: boolean; error?: string };

function refreshInventoryViews() {
  revalidateTag("products", "max");
  revalidatePath("/admin/compras");
  revalidatePath("/admin/estoque");
}

function positiveQuantity(value: number): number | null {
  const qty = Math.trunc(Number(value));
  return Number.isSafeInteger(qty) && qty > 0 && qty <= 100_000 ? qty : null;
}

function expiryDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return date > startOfToday ? date : null;
}

export async function receiveInventoryLot(input: {
  productId: string;
  pharmacyId: string;
  lotCode: string;
  expiresOn: string;
  qty: number;
  supplier?: string;
  note?: string;
}): Promise<LotActionResult> {
  await assertArea("compras");
  const actor = await requireAdminAtPharmacy(input.pharmacyId);
  const qty = positiveQuantity(input.qty);
  const lotCode = input.lotCode.trim().toUpperCase().slice(0, 120);
  const expiresAt = expiryDate(input.expiresOn);
  const supplier = input.supplier?.trim().slice(0, 160) || null;
  const note = input.note?.trim().slice(0, 500) || null;

  if (!qty) return { ok: false, error: "Informe uma quantidade entre 1 e 100.000." };
  if (!lotCode) return { ok: false, error: "Informe o lote recebido." };
  if (!expiresAt) return { ok: false, error: "Informe uma validade futura válida." };

  try {
    await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_pharmacyId: {
            productId: input.productId,
            pharmacyId: input.pharmacyId,
          },
        },
        select: { id: true },
      });
      if (!inventory) throw new Error("Produto não está vinculado a esta unidade.");

      const lot = await tx.inventoryLot.upsert({
        where: {
          productId_pharmacyId_lotCode: {
            productId: input.productId,
            pharmacyId: input.pharmacyId,
            lotCode,
          },
        },
        create: {
          productId: input.productId,
          pharmacyId: input.pharmacyId,
          lotCode,
          expiresAt,
          qty,
          supplier,
          note,
        },
        update: {
          expiresAt,
          qty: { increment: qty },
          supplier,
          note,
          receivedAt: new Date(),
        },
        select: { id: true },
      });
      const movement = await changeInventory(tx, {
        productId: input.productId,
        pharmacyId: input.pharmacyId,
        delta: qty,
        kind: "RECEIPT",
        reason: `Recebimento do lote ${lotCode}, validade ${input.expiresOn}`,
        referenceType: "INVENTORY_LOT",
        referenceId: lot.id,
        actor,
      });
      await logAuditInTransaction(tx, {
        action: "inventory.lot.receive",
        entity: "InventoryLot",
        entityId: lot.id,
        pharmacyId: input.pharmacyId,
        detail: `Recebeu ${qty} un do lote ${lotCode}: ${movement.stockBefore} → ${movement.stockAfter}`,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível receber o lote.",
    };
  }

  refreshInventoryViews();
  return { ok: true };
}

export async function writeOffInventoryLot(input: {
  lotId: string;
  pharmacyId: string;
  qty: number;
  reason: string;
}): Promise<LotActionResult> {
  await assertArea("estoque");
  const actor = await requireAdminAtPharmacy(input.pharmacyId);
  const qty = positiveQuantity(input.qty);
  const reason = input.reason.trim().slice(0, 300);
  if (!qty) return { ok: false, error: "Informe uma quantidade válida." };
  if (!reason) return { ok: false, error: "Informe o motivo da baixa." };

  try {
    await prisma.$transaction(async (tx) => {
      const lot = await tx.inventoryLot.findFirst({
        where: { id: input.lotId, pharmacyId: input.pharmacyId },
        select: { id: true, productId: true, lotCode: true },
      });
      if (!lot) throw new Error("Lote não encontrado nesta unidade.");
      const changed = await tx.inventoryLot.updateMany({
        where: { id: lot.id, qty: { gte: qty } },
        data: { qty: { decrement: qty } },
      });
      if (changed.count !== 1) throw new Error("Saldo insuficiente neste lote.");
      const movement = await changeInventory(tx, {
        productId: lot.productId,
        pharmacyId: input.pharmacyId,
        delta: -qty,
        kind: "LOSS",
        reason: `${reason} (lote ${lot.lotCode})`,
        referenceType: "INVENTORY_LOT",
        referenceId: lot.id,
        actor,
      });
      await logAuditInTransaction(tx, {
        action: "inventory.lot.write_off",
        entity: "InventoryLot",
        entityId: lot.id,
        pharmacyId: input.pharmacyId,
        detail: `Baixou ${qty} un do lote ${lot.lotCode}: ${movement.stockBefore} → ${movement.stockAfter}`,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InsufficientInventoryError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Não foi possível baixar o lote.",
    };
  }

  refreshInventoryViews();
  return { ok: true };
}
