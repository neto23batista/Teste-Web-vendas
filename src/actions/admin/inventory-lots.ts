"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy } from "@/lib/auth/session";
import { changeInventory, InsufficientInventoryError } from "@/lib/inventory/movements";
import { parseInventoryLotExpiry } from "@/lib/inventory/lots";
import { logAuditInTransaction } from "@/lib/audit";
import { reportError } from "@/lib/monitoring";

export type LotActionResult = { ok: boolean; error?: string };

function refreshInventoryViews() {
  revalidateTag("products", "max");
  revalidatePath("/admin/compras");
  revalidatePath("/admin/estoque");
}

const identifier = z.string().trim().min(1).max(191);
const quantity = z.number().int().min(1).max(100_000);
const receiptSchema = z.object({
  productId: identifier,
  pharmacyId: identifier,
  lotCode: z.string().trim().min(1).max(120).transform((value) => value.toUpperCase()),
  expiresOn: z.string(),
  qty: quantity,
  supplier: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
});
const writeOffSchema = z.object({
  lotId: identifier,
  pharmacyId: identifier,
  qty: quantity,
  reason: z.string().trim().min(1).max(300),
});

class InventoryLotError extends Error {}

async function lockInventory(tx: Prisma.TransactionClient, productId: string, pharmacyId: string) {
  // Toda operação usa a mesma ordem: estoque agregado, depois lote. Além de
  // serializar recebimentos, evita deadlock com a reserva de pedidos.
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Inventory"
    WHERE "productId" = ${productId} AND "pharmacyId" = ${pharmacyId}
    FOR UPDATE
  `;
  if (rows.length !== 1) throw new InventoryLotError("Produto não está vinculado a esta unidade.");
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
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Confira os dados do lote e informe uma quantidade inteira entre 1 e 100.000." };
  }
  input = parsed.data;
  const actor = await requireAdminAtPharmacy(input.pharmacyId);
  const { qty, lotCode } = input;
  const expiresAt = parseInventoryLotExpiry(input.expiresOn);
  const supplier = input.supplier || null;
  const note = input.note || null;

  if (!expiresAt) return { ok: false, error: "Informe uma data de validade válida, não vencida." };

  try {
    await prisma.$transaction(async (tx) => {
      await lockInventory(tx, input.productId, input.pharmacyId);
      const existing = await tx.inventoryLot.findUnique({
        where: {
          productId_pharmacyId_lotCode: {
            productId: input.productId,
            pharmacyId: input.pharmacyId,
            lotCode,
          },
        },
        select: { id: true, expiresAt: true },
      });
      if (existing && existing.expiresAt.toISOString().slice(0, 10) !== input.expiresOn) {
        throw new InventoryLotError("Este lote já está cadastrado com outra validade. Confira o lote informado.");
      }

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
          qty: { increment: qty },
          ...(supplier ? { supplier } : {}),
          ...(note ? { note } : {}),
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
    if (!(error instanceof InventoryLotError)) {
      reportError(error, { operation: "inventory.lot.receive" });
    }
    return {
      ok: false,
      error: error instanceof InventoryLotError ? error.message : "Não foi possível receber o lote.",
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
  const parsed = writeOffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Informe o lote, o motivo e uma quantidade inteira entre 1 e 100.000." };
  }
  input = parsed.data;
  const actor = await requireAdminAtPharmacy(input.pharmacyId);
  const { qty, reason } = input;

  try {
    await prisma.$transaction(async (tx) => {
      const lot = await tx.inventoryLot.findFirst({
        where: { id: input.lotId, pharmacyId: input.pharmacyId },
        select: { id: true, productId: true, lotCode: true },
      });
      if (!lot) throw new InventoryLotError("Lote não encontrado nesta unidade.");
      await lockInventory(tx, lot.productId, input.pharmacyId);
      const changed = await tx.inventoryLot.updateMany({
        where: { id: lot.id, qty: { gte: qty } },
        data: { qty: { decrement: qty } },
      });
      if (changed.count !== 1) throw new InventoryLotError("Saldo insuficiente neste lote.");
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
    const expected = error instanceof InventoryLotError || error instanceof InsufficientInventoryError;
    if (!expected) reportError(error, { operation: "inventory.lot.write_off" });
    return {
      ok: false,
      error: expected ? error.message : "Não foi possível baixar o lote.",
    };
  }

  refreshInventoryViews();
  return { ok: true };
}
