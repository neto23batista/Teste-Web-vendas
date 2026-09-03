import type { Prisma } from "@prisma/client";
import { reportError } from "@/lib/monitoring";

/**
 * Gravação da trilha de auditoria SEM depender de sessão.
 *
 * Este módulo existe separado de `@/lib/audit` de propósito: aquele resolve o
 * ator lendo a sessão atual e por isso arrasta `next-auth` junto. Módulos de
 * domínio (pedidos, estoque, pagamentos) precisam registrar evidência dentro da
 * própria transação sem carregar a camada de autenticação — o ator já veio
 * capturado pelo guard, lá na fronteira.
 */

export type AuditActor = {
  id: string | null;
  email: string | null;
};

export type AuditRecord = {
  action: string;
  entity?: string;
  entityId?: string;
  detail?: string;
  pharmacyId?: string | null;
};

export type TransactionAuditInput = AuditRecord & {
  /** Obrigatório: uma transação nunca relê cookies/sessão no meio. */
  actor: AuditActor | null;
};

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">;

export async function writeAudit(
  client: AuditWriter,
  input: AuditRecord,
  actor: AuditActor | null,
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
 *
 * A falha propaga de propósito: numa transação, propagar significa desfazer a
 * mutação — que é exatamente o comportamento desejado quando a evidência
 * obrigatória não pôde ser gravada.
 */
export async function logAuditInTransaction(
  tx: Prisma.TransactionClient,
  input: TransactionAuditInput,
): Promise<void> {
  try {
    await writeAudit(tx, input, input.actor);
  } catch (error) {
    reportError(error, { operation: "audit.write", action: input.action });
    throw error;
  }
}
