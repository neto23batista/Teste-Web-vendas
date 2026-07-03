import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * Registra uma ação do admin na trilha de auditoria. Best-effort: nunca lança e
 * não bloqueia a resposta — o ator é resolvido ainda no request (a sessão vem
 * do cookie), mas o INSERT roda via `after()`, depois do flush da resposta.
 * Resiliente — antes da migration `audit_log`, o insert falha e é ignorado.
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
    after(async () => {
      try {
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
    });
  } catch (err) {
    console.error("[audit] falha ao registrar ação:", err);
  }
}
