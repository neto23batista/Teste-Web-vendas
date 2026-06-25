import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * Registra uma ação do admin na trilha de auditoria. Best-effort: nunca lança e
 * nunca bloqueia a ação principal (que já foi concluída). Resiliente — antes da
 * migration `audit_log`, o insert falha e é silenciosamente ignorado.
 *
 * `action` em ponto-notação estável (ex.: "order.status", "stock.transfer").
 * `detail` é uma frase legível mostrada no painel.
 */
export async function logAudit(input: {
  action: string;
  entity?: string;
  entityId?: string;
  detail?: string;
  pharmacyId?: string | null;
}): Promise<void> {
  try {
    const user = await getCurrentUser();
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        detail: input.detail ?? null,
        pharmacyId: input.pharmacyId ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] falha ao registrar ação:", err);
  }
}
