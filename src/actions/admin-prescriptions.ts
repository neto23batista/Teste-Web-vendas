"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertArea, requireAdminAtPharmacy } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { sendMail, baseUrl } from "@/lib/mail";
import { prescriptionStatusEmail } from "@/lib/email-templates";
import { PRESCRIPTION_STATUS_LABEL } from "@/lib/prescription-status";
import type { PrescriptionStatus } from "@prisma/client";

export async function setPrescriptionStatus(
  id: string,
  status: PrescriptionStatus,
  reason?: string
) {
  // Validação farmacêutica é ato do FARMACÊUTICO (ou do dono): é ela que libera
  // um pedido com receita/controlado a avançar. Sem este portão, um estoquista ou
  // atendente aprovaria a receita e despacharia o controlado.
  await assertArea("receitas");

  // Filial só valida receitas de pedidos da PRÓPRIA unidade; matriz, de todas.
  // (Receita sem pedido/unidade: qualquer admin com a área — não libera pedido.)
  const target = await prisma.prescription.findUnique({
    where: { id },
    select: { order: { select: { pharmacyId: true } } },
  });
  if (!target) return { ok: false };
  if (target.order?.pharmacyId) {
    await requireAdminAtPharmacy(target.order.pharmacyId);
  }

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

  await logAudit({
    action: "prescription.status",
    entity: "Prescription",
    entityId: id,
    detail: `Receita ${pres.order?.number ? `do pedido ${pres.order.number} ` : ""}→ ${PRESCRIPTION_STATUS_LABEL[status]}`,
  });

  revalidatePath("/admin/receitas");
  revalidatePath("/conta/receitas");
  if (pres.orderId) revalidatePath(`/admin/pedidos/${pres.orderId}`);
  return { ok: true };
}
