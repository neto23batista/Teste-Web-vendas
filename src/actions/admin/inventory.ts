"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  assertArea,
  requireAdmin,
  requireAdminAtPharmacy,
} from "@/lib/auth/session";
import { logAuditInTransaction } from "@/lib/audit";
import { centsToDecimal, parseMoneyInputToCents } from "@/lib/money";
import { Prisma } from "@prisma/client";
import {
  changeInventory,
  InsufficientInventoryError,
} from "@/lib/inventory/movements";
import { InventoryLotBalanceError } from "@/lib/inventory/lots";
import { transferPhysicalInventory } from "@/lib/inventory/lot-transfers";
import { reportError } from "@/lib/monitoring";
import {
  revalidateProducts,
  isCatalogAdmin,
} from "@/lib/catalog/admin-support";

export type UnitOfferValues = {
  price: string;
  promoPrice: string;
  costPrice: string;
  sku: string;
  ean: string;
};

export async function updateUnitOffer(
  productId: string,
  pharmacyId: string,
  values: UnitOfferValues,
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("estoque");
  const actor = await requireAdminAtPharmacy(pharmacyId);
  const priceCents = parseMoneyInputToCents(values.price);
  const promoCents = values.promoPrice.trim()
    ? parseMoneyInputToCents(values.promoPrice)
    : null;
  const costCents = values.costPrice.trim()
    ? parseMoneyInputToCents(values.costPrice)
    : null;
  const sku = values.sku.trim().slice(0, 120) || null;
  const ean = values.ean.replace(/\s+/g, "").slice(0, 32) || null;

  if (priceCents === null || priceCents <= 0) {
    return { ok: false, error: "Informe um preço maior que zero." };
  }
  if (values.promoPrice.trim() && promoCents === null) {
    return { ok: false, error: "Preço promocional inválido." };
  }
  if (promoCents !== null && (promoCents <= 0 || promoCents >= priceCents)) {
    return {
      ok: false,
      error: "A promoção deve ser maior que zero e menor que o preço.",
    };
  }
  if (values.costPrice.trim() && costCents === null) {
    return { ok: false, error: "Custo inválido." };
  }
  if (ean && !/^\d{8,14}$/.test(ean)) {
    return { ok: false, error: "O EAN deve conter de 8 a 14 dígitos." };
  }

  const offer = {
    price: centsToDecimal(priceCents),
    promoPrice: promoCents == null ? null : centsToDecimal(promoCents),
    costPrice: costCents == null ? null : centsToDecimal(costCents),
    sku,
    ean,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const [inventory, pharmacy] = await Promise.all([
        tx.inventory.findUnique({
          where: { productId_pharmacyId: { productId, pharmacyId } },
          select: { id: true },
        }),
        tx.pharmacy.findUnique({
          where: { id: pharmacyId },
          select: { type: true },
        }),
      ]);
      if (!inventory || !pharmacy)
        throw new Error("Oferta da unidade não encontrada.");

      await tx.inventory.update({
        where: { id: inventory.id },
        data: offer,
      });
      // O cadastro canônico acompanha a matriz e continua sendo o fallback para
      // registros legados ainda sem oferta local.
      if (pharmacy.type === "MATRIZ") {
        await tx.product.update({ where: { id: productId }, data: offer });
      }
      await logAuditInTransaction(tx, {
        action: "inventory.offer.update",
        entity: "Inventory",
        entityId: inventory.id,
        detail: `Atualizou oferta da unidade (preço ${offer.price}, SKU ${sku ?? "-"}, EAN ${ean ?? "-"})`,
        pharmacyId,
        actor: { id: actor.id ?? null, email: actor.email ?? null },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "SKU ou EAN já está em uso nesta unidade." };
    }
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a oferta.",
    };
  }

  revalidateProducts();
  revalidatePath("/admin/estoque");
  return { ok: true };
}

export async function adjustStock(
  productId: string,
  pharmacyId: string,
  delta: number,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  await assertArea("estoque");
  // Filial só ajusta a própria unidade; matriz, qualquer uma.
  const actor = await requireAdminAtPharmacy(pharmacyId);
  if (
    !Number.isSafeInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > 100_000
  ) {
    return {
      ok: false,
      error: "Informe um ajuste inteiro entre -100.000 e 100.000.",
    };
  }
  const normalizedReason = reason.trim().slice(0, 500);
  if (!normalizedReason) {
    return { ok: false, error: "Informe o motivo do ajuste de estoque." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const movement = await changeInventory(tx, {
        productId,
        pharmacyId,
        delta,
        kind: "MANUAL_ADJUSTMENT",
        reason: normalizedReason,
        actor,
      });
      if (delta < 0) {
        const lots = await tx.inventoryLot.aggregate({
          where: { productId, pharmacyId },
          _sum: { qty: true },
        });
        if ((lots._sum.qty ?? 0) > movement.stockAfter) {
          throw new InventoryLotBalanceError(
            "Este ajuste atingiria estoque rastreado. Registre a baixa no lote em Compras.",
          );
        }
      }
      await logAuditInTransaction(tx, {
        action: "stock.adjust",
        entity: "Inventory",
        entityId: movement.inventoryId,
        detail: `${normalizedReason}: ${movement.stockBefore} → ${movement.stockAfter}`,
        pharmacyId,
        actor: {
          id: actor.id ?? null,
          email: actor.email ?? null,
        },
      });
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InsufficientInventoryError ||
        error instanceof InventoryLotBalanceError
          ? error.message
          : "Não foi possível ajustar o estoque.",
    };
  }
  revalidateProducts();
  revalidatePath("/admin/estoque");
  return { ok: true };
}

/**
 * Transfere `qty` de um produto entre unidades (rebalanceamento/reposição).
 * Atômico e anti-corrida: baixa condicional na origem (só move se houver saldo)
 * e soma no destino (cria a linha se faltar). Só a matriz move estoque entre
 * unidades.
 */
export async function transferStock(
  productId: string,
  fromPharmacyId: string,
  toPharmacyId: string,
  qty: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isCatalogAdmin())) {
    return {
      ok: false,
      error: "Apenas a matriz transfere estoque entre unidades.",
    };
  }
  if (fromPharmacyId === toPharmacyId) {
    return {
      ok: false,
      error: "Escolha unidades de origem e destino diferentes.",
    };
  }
  if (!Number.isSafeInteger(qty) || qty <= 0 || qty > 100_000) {
    return {
      ok: false,
      error: "Informe uma quantidade inteira entre 1 e 100.000.",
    };
  }

  try {
    const actor = await requireAdmin();
    const transferId = randomUUID();
    await prisma.$transaction(async (tx) => {
      await transferPhysicalInventory(tx, {
        productId,
        fromPharmacyId,
        toPharmacyId,
        qty,
        transferId,
        actor,
      });
      await logAuditInTransaction(tx, {
        action: "stock.transfer",
        entity: "Product",
        entityId: productId,
        detail: `Transferiu ${qty} un entre unidades preservando lotes e validades (${transferId})`,
        pharmacyId: toPharmacyId,
        actor: {
          id: actor.id ?? null,
          email: actor.email ?? null,
        },
      });
    });
  } catch (e) {
    const expected =
      e instanceof InsufficientInventoryError ||
      e instanceof InventoryLotBalanceError;
    if (!expected) reportError(e, { operation: "stock.transfer" });
    return {
      ok: false,
      error: expected ? e.message : "Falha ao transferir estoque.",
    };
  }

  revalidateProducts();
  revalidatePath("/admin/estoque");
  revalidatePath("/admin/compras");
  return { ok: true };
}
