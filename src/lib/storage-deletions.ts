import { Prisma } from "@prisma/client";
import { reportError } from "@/lib/monitoring";
import { deleteObject } from "@/lib/storage";

type DeletionWriter = Pick<Prisma.TransactionClient, "storageDeletionTask">;

const MAX_TASKS_PER_RUN = 100;

/** Registra a intenção de exclusão dentro da mesma transação dos dados pessoais. */
export async function enqueueStorageDeletions(
  tx: DeletionWriter,
  rawKeys: readonly string[]
): Promise<number> {
  const keys = [...new Set(rawKeys.map((key) => key.trim()))].filter(
    (key) => key.length > 0 && key.length <= 1_024 && !key.includes("\0")
  );
  if (keys.length !== new Set(rawKeys).size) {
    throw new Error("Chave de storage inválida na fila de exclusão");
  }
  if (keys.length === 0) return 0;
  const created = await tx.storageDeletionTask.createMany({
    data: keys.map((storageKey) => ({ storageKey })),
    skipDuplicates: true,
  });
  return created.count;
}

export function storageDeletionRetryAt(
  attempts: number,
  now = new Date()
): Date {
  const exponent = Math.min(Math.max(attempts - 1, 0), 11);
  const delayMs = Math.min(24 * 60 * 60_000, 60_000 * 2 ** exponent);
  return new Date(now.getTime() + delayMs);
}

type ClaimedDeletion = {
  id: string;
  storageKey: string;
  attempts: number;
};

async function claimStorageDeletions(limit: number): Promise<ClaimedDeletion[]> {
  const { prisma } = await import("@/lib/prisma");
  return prisma.$queryRaw<ClaimedDeletion[]>(Prisma.sql`
    WITH candidates AS (
      SELECT "id"
      FROM "StorageDeletionTask"
      WHERE
        (
          "status" IN ('PENDING', 'FAILED')
          AND "nextAttemptAt" <= CURRENT_TIMESTAMP
        )
        OR (
          "status" = 'PROCESSING'
          AND "claimedAt" < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        )
      ORDER BY "nextAttemptAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "StorageDeletionTask" task
    SET
      "status" = 'PROCESSING',
      "attempts" = task."attempts" + 1,
      "claimedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM candidates
    WHERE task."id" = candidates."id"
    RETURNING task."id", task."storageKey", task."attempts"
  `);
}

export type StorageDeletionRun = {
  claimed: number;
  completed: number;
  failed: number;
};

/** Reivindica com SKIP LOCKED e processa tarefas idempotentes, inclusive órfãs. */
export async function processStorageDeletionTasks(
  requestedLimit = 25
): Promise<StorageDeletionRun> {
  const { prisma } = await import("@/lib/prisma");
  const limit = Math.min(
    MAX_TASKS_PER_RUN,
    Math.max(1, Math.trunc(requestedLimit))
  );
  const tasks = await claimStorageDeletions(limit);
  let completed = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      await deleteObject(task.storageKey);
      await prisma.storageDeletionTask.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          claimedAt: null,
          lastError: null,
        },
      });
      completed += 1;
    } catch (error) {
      reportError(error, { operation: "storage.delete_private_object" });
      await prisma.storageDeletionTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          claimedAt: null,
          nextAttemptAt: storageDeletionRetryAt(task.attempts),
          lastError: "Falha temporária no provedor de armazenamento",
        },
      });
      failed += 1;
    }
  }

  return { claimed: tasks.length, completed, failed };
}
