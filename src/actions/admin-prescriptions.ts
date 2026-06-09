"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import type { PrescriptionStatus } from "@prisma/client";

export async function setPrescriptionStatus(
  id: string,
  status: PrescriptionStatus
) {
  await requireAdmin();
  const pres = await prisma.prescription.update({
    where: { id },
    data: { status },
    select: { orderId: true },
  });

  revalidatePath("/admin/receitas");
  revalidatePath("/conta/receitas");
  if (pres.orderId) revalidatePath(`/admin/pedidos/${pres.orderId}`);
  return { ok: true };
}
