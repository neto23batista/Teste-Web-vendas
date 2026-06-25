import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { getStoreSettings } from "@/lib/settings";

/**
 * E-mails que recebem avisos operacionais de uma unidade: os admins vinculados
 * à unidade. Sem nenhum admin na unidade, cai no e-mail global da loja
 * (Configurações). Tolerante a falha de banco (retorna o que conseguir).
 */
export async function unitRecipients(
  pharmacyId: string | null
): Promise<string[]> {
  const emails = new Set<string>();
  if (pharmacyId) {
    const admins = await prisma.user
      .findMany({
        where: { role: "ADMIN", pharmacyId },
        select: { email: true },
      })
      .catch(() => [] as { email: string }[]);
    for (const a of admins) if (a.email) emails.add(a.email);
  }
  if (emails.size === 0) {
    const g = await getStoreSettings().catch(() => null);
    if (g?.email) emails.add(g.email);
  }
  return [...emails];
}

/**
 * Envia um aviso a toda a equipe da unidade (best-effort — nunca lança; uma
 * falha de e-mail não pode quebrar o fluxo de pedido/estoque).
 */
export async function notifyUnit(
  pharmacyId: string | null,
  mail: { subject: string; html: string }
): Promise<void> {
  try {
    const to = await unitRecipients(pharmacyId);
    await Promise.all(
      to.map((addr) =>
        sendMail({ to: addr, subject: mail.subject, html: mail.html })
      )
    );
  } catch (err) {
    console.error("[notifyUnit] falha ao notificar a unidade:", err);
  }
}
