import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { reportError } from "@/lib/monitoring";
import {
  writeAudit,
  type AuditActor,
  type AuditRecord,
} from "@/lib/audit-write";

export type { AuditActor, TransactionAuditInput } from "@/lib/audit-write";
export { logAuditInTransaction } from "@/lib/audit-write";

export type AuditInput = AuditRecord & {
  /**
   * Use quando a mutação revoga a sessão do próprio ator antes de gravar a
   * auditoria. `undefined` resolve a sessão atual; `null` registra um evento de
   * sistema/anônimo de forma intencional.
   */
  actor?: AuditActor | null;
};

/**
 * Registra uma ação na trilha de auditoria antes de devolver o controle ao
 * chamador. A Promise só resolve depois que o INSERT foi confirmado.
 *
 * A falha é reportada e propagada por padrão: uma operação sensível não pode
 * aparentar sucesso quando sua evidência obrigatória não foi persistida.
 *
 * Prefira `logAuditInTransaction` em qualquer comando que altere estado: esta
 * função garante durabilidade, não rollback da mutação anterior. Ela resolve a
 * sessão atual, então só serve fora de transação — e por isso mora aqui, longe
 * do módulo puro que o domínio importa.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const resolvedActor =
      input.actor === undefined ? await getCurrentUser() : input.actor;
    const actor: AuditActor | null = resolvedActor
      ? {
          id: resolvedActor.id ?? null,
          email: resolvedActor.email ?? null,
        }
      : null;
    await writeAudit(prisma, input, actor);
  } catch (error) {
    reportError(error, { operation: "audit.write", action: input.action });
    throw error;
  }
}
