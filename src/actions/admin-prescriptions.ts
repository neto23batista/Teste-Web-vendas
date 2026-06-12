"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { sendMail, baseUrl } from "@/lib/mail";
import { prescriptionStatusEmail } from "@/lib/email-templates";
import type { PrescriptionStatus } from "@prisma/client";

export async function setPrescriptionStatus(
  id: string,
  status: PrescriptionStatus,
  reason?: string
) {
  await requireAdmin();
  const pres = await prisma.prescription.update({
    where: { id },
    data: { status },
    select: {
      orderId: true,
      user: { select: { name: true, email: true } },
      order: { select: { number: true } },
    },
  });

  // Notifica o cliente da decisão (best-effort — não bloqueia a validação).
  if (
    (status === "APPROVED" || status === "REJECTED") &&
    pres.user.email
  ) {
    const url = pres.order
      ? `${baseUrl()}/pedido/${pres.order.number}`
      : `${baseUrl()}/conta/receitas`;
    const mail = prescriptionStatusEmail(
      pres.user.name,
      pres.order?.number ?? null,
      status === "APPROVED",
      reason?.trim().slice(0, 300) || undefined,
      url
    );
    await sendMail({ to: pres.user.email, subject: mail.subject, html: mail.html });
  }

  revalidatePath("/admin/receitas");
  revalidatePath("/conta/receitas");
  if (pres.orderId) revalidatePath(`/admin/pedidos/${pres.orderId}`);
  return { ok: true };
}
