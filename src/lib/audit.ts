import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { reportError } from "@/lib/monitoring";

export type AuditActor = {
  id: string | null;
  email: string | null;
};

export type AuditInput = {
  action: string;
  entity?: string;
  entityId?: string;
  detail?: string;
  pharmacyId?: string | null;
  /**
   * Use quando a mutação revoga a sessão do próprio ator antes de gravar a
   * auditoria. `undefined` resolve a sessão atual; `null` registra um evento de
   * sistema/anônimo de forma intencional.
   */
  actor?: AuditActor | null;
};

export type TransactionAuditInput = Omit<AuditInput, "actor"> & {
  /** Obrigatório: uma transação nunca relê cookies/sessão no meio. */
  actor: AuditActor | null;
};

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">;

async function writeAudit(
  client: AuditWriter,
  input: Omit<AuditInput, "actor">,
  actor: AuditActor | null
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: actor?.id ?? null,
      userEmail: actor?.email ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      detail: input.detail ?? null,
      pharmacyId: input.pharmacyId ?? null,
    },
  });
}

/**
 * Grava a evidência usando o mesmo `TransactionClient` da mutação. O ator
 * precisa ter sido capturado pelo guard antes da transação; nenhuma sessão é
 * relida enquanto locks do banco estão abertos.
 */
export async function logAuditInTransaction(
  tx: Prisma.TransactionClient,
  input: TransactionAuditInput
): Promise<void> {
  try {
    await writeAudit(tx, input, input.actor);
  } catch (error) {
    reportError(error, { operation: "audit.write", action: input.action });
    throw error;
  }
}

/**
 * Registra uma ação na trilha de auditoria antes de devolver o controle ao
 * chamador. A Promise só resolve depois que o INSERT foi confirmado.
 *
 * A falha é reportada e propagada por padrão: uma operação sensível não pode
 * aparentar sucesso quando sua evidência obrigatória não foi persistida.
 * Chamadores que precisam de atomicidade entre a mutação e o log devem criar
 * ambos na mesma transação; esta função garante durabilidade, não rollback da
 * mutação anterior.
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
