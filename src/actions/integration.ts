"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  assertArea,
  assertOwner,
  requireAdminAtPharmacy,
} from "@/lib/session";
import { newIntegrationToken } from "@/lib/integration-auth";
import { logAudit } from "@/lib/audit";

/**
 * Gera (ou regenera) o token do conector de uma unidade. O token em claro é
 * retornado UMA única vez — só o hash fica no banco. Regenerar invalida o
 * token anterior (o conector da unidade precisa ser atualizado).
 */
export async function generateIntegrationToken(
  pharmacyId: string
): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    // Rotacionar esta credencial derruba imediatamente o conector atual.
    // Por isso, além do escopo da unidade, exige OWNER.
    await assertOwner();
    await requireAdminAtPharmacy(pharmacyId);
  } catch {
    return { ok: false, error: "Sem permissão para esta unidade." };
  }

  const { token, hash } = newIntegrationToken();
  const rotatedAt = new Date();
  const rotated = await prisma.pharmacy.updateMany({
    where: { id: pharmacyId, archivedAt: null },
    data: {
      integrationTokenHash: hash,
      integrationTokenLastUsedAt: null,
      integrationTokenRotatedAt: rotatedAt,
    },
  });
  if (rotated.count === 0) {
    return { ok: false, error: "Unidade não encontrada ou arquivada." };
  }

  await logAudit({
    action: "integration.token",
    entity: "Pharmacy",
    entityId: pharmacyId,
    detail: "Token do conector InovaFarma (re)gerado",
    pharmacyId,
  });

  revalidatePath("/admin/integracao");
  return { ok: true, token };
}

/** Recoloca uma exportação com erro na fila (volta a PENDING). */
export async function retryOrderExport(
  orderExportId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertArea("integracao");
  } catch {
    return { ok: false, error: "Sem permissão para esta ação." };
  }

  const exp = await prisma.orderExport.findUnique({
    where: { id: orderExportId },
    select: { id: true, pharmacyId: true, status: true, order: { select: { number: true } } },
  });
  if (!exp) return { ok: false, error: "Exportação não encontrada." };
  try {
    await requireAdminAtPharmacy(exp.pharmacyId);
  } catch {
    return { ok: false, error: "Sem permissão para esta unidade." };
  }
  if (exp.status === "SENT") {
    return { ok: false, error: "Este pedido já foi exportado." };
  }

  await prisma.orderExport.update({
    where: { id: exp.id },
    data: { status: "PENDING", lastError: null },
  });

  await logAudit({
    action: "integration.retry",
    entity: "OrderExport",
    entityId: exp.id,
    detail: `Pedido ${exp.order.number} recolocado na fila de exportação`,
    pharmacyId: exp.pharmacyId,
  });

  revalidatePath("/admin/integracao");
  return { ok: true };
}
