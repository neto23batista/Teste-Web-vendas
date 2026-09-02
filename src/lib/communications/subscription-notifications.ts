import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { subscriptionDueEmail } from "@/lib/communications/email-templates";
import { baseUrl, sendMail } from "@/lib/communications/mail";
import { prisma } from "@/lib/prisma";
import { isValidInterval } from "@/lib/commerce/subscription-policy";

const ORPHANED_CLAIM_MS = 15 * 60_000;
const MAX_ENQUEUE_PER_RUN = 100;
const MAX_DELIVERIES_PER_RUN = 50;
const DELIVERY_CONCURRENCY = 5;

type ReminderEligibility = {
  intervalDays: number;
  productActive: boolean;
  requiresPrescription: boolean;
  email: string;
};

/** Falha fechado para dados legados/corrompidos e contas anonimizadas. */
export function subscriptionReminderEligible({
  intervalDays,
  productActive,
  requiresPrescription,
  email,
}: ReminderEligibility): boolean {
  return (
    isValidInterval(intervalDays) &&
    productActive &&
    !requiresPrescription &&
    !email.toLowerCase().endsWith("@anon.invalid")
  );
}

/** Backoff exponencial entre 1 minuto e 24 horas. */
export function subscriptionNotificationRetryAt(
  attempts: number,
  now = new Date()
): Date {
  const exponent = Math.min(Math.max(Math.trunc(attempts) - 1, 0), 20);
  const delayMs = Math.min(24 * 60 * 60_000, 60_000 * 2 ** exponent);
  return new Date(now.getTime() + delayMs);
}

/** Chave opaca, estável por notificação e sempre aceita pelo Resend. */
export function subscriptionNotificationIdempotencyKey(id: string): string {
  const digest = createHash("sha256").update(id).digest("hex");
  return `subscription/${digest}`;
}

function boundedLimit(requested: number, maximum: number): number {
  return Math.min(maximum, Math.max(1, Math.trunc(requested)));
}

type DueSubscriptionCandidate = {
  id: string;
  dueAt: Date;
  intervalDays: number;
  productActive: boolean;
  requiresPrescription: boolean;
  email: string;
};

export type SubscriptionEnqueueRun = {
  inspected: number;
  queued: number;
  advanced: number;
  paused: number;
};

/**
 * Reserva as assinaturas vencidas com SKIP LOCKED. A notificação do ciclo e
 * o novo vencimento são confirmados na mesma transação: ou ambos existem,
 * ou nenhum deles existe.
 */
export async function enqueueDueSubscriptionNotifications(
  requestedLimit = MAX_ENQUEUE_PER_RUN,
  now = new Date()
): Promise<SubscriptionEnqueueRun> {
  const limit = boundedLimit(requestedLimit, MAX_ENQUEUE_PER_RUN);

  return prisma.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<DueSubscriptionCandidate[]>(Prisma.sql`
      SELECT
        due_subscription."id",
        due_subscription."nextDueAt" AS "dueAt",
        due_subscription."intervalDays",
        product."active" AS "productActive",
        product."requiresPrescription",
        app_user."email"
      FROM "Subscription" due_subscription
      INNER JOIN "Product" product ON product."id" = due_subscription."productId"
      INNER JOIN "User" app_user ON app_user."id" = due_subscription."userId"
      WHERE
        due_subscription."status" = 'ACTIVE'
        AND due_subscription."nextDueAt" <= ${now}
      ORDER BY due_subscription."nextDueAt" ASC
      FOR UPDATE OF due_subscription SKIP LOCKED
      LIMIT ${limit}
    `);

    const eligible = candidates.filter(subscriptionReminderEligible);
    const blocked = candidates.filter(
      (candidate) => !subscriptionReminderEligible(candidate)
    );

    let paused = 0;
    if (blocked.length > 0) {
      const result = await tx.subscription.updateMany({
        where: {
          id: { in: blocked.map(({ id }) => id) },
          status: "ACTIVE",
        },
        data: { status: "PAUSED" },
      });
      paused = result.count;
      if (paused !== blocked.length) {
        throw new Error("Falha ao pausar assinatura inelegível reservada");
      }
    }

    let queued = 0;
    let advanced = 0;
    if (eligible.length > 0) {
      const created = await tx.subscriptionNotification.createMany({
        data: eligible.map(({ id, dueAt }) => ({
          subscriptionId: id,
          dueAt,
        })),
        // Recupera com segurança um eventual ciclo já enfileirado sem
        // produzir uma segunda notificação para o mesmo vencimento.
        skipDuplicates: true,
      });
      queued = created.count;

      const ids = eligible.map(({ id }) => id);
      advanced = await tx.$executeRaw(Prisma.sql`
        UPDATE "Subscription"
        SET
          "nextDueAt" = ${now} + ("intervalDays" * INTERVAL '1 day'),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "id" IN (${Prisma.join(ids)})
          AND "status" = 'ACTIVE'
          AND "nextDueAt" <= ${now}
      `);
      if (advanced !== eligible.length) {
        throw new Error("Falha ao avançar ciclo de assinatura reservado");
      }
    }

    return {
      inspected: candidates.length,
      queued,
      advanced,
      paused,
    };
  });
}

type ClaimedNotification = {
  id: string;
  subscriptionId: string;
  attempts: number;
  claimedAt: Date;
};

async function claimSubscriptionNotifications(
  requestedLimit: number,
  now = new Date()
): Promise<ClaimedNotification[]> {
  const limit = boundedLimit(requestedLimit, MAX_DELIVERIES_PER_RUN);
  const orphanedBefore = new Date(now.getTime() - ORPHANED_CLAIM_MS);

  return prisma.$queryRaw<ClaimedNotification[]>(Prisma.sql`
    WITH candidates AS (
      SELECT task."id"
      FROM "SubscriptionNotification" task
      WHERE
        (
          task."status" IN ('PENDING', 'FAILED')
          AND task."nextAttemptAt" <= ${now}
        )
        OR (
          task."status" = 'PROCESSING'
          AND (
            task."claimedAt" IS NULL
            OR task."claimedAt" < ${orphanedBefore}
          )
        )
      ORDER BY task."nextAttemptAt" ASC
      FOR UPDATE OF task SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "SubscriptionNotification" task
    SET
      "status" = 'PROCESSING',
      "attempts" = task."attempts" + 1,
      "claimedAt" = ${now},
      "updatedAt" = CURRENT_TIMESTAMP
    FROM candidates
    WHERE task."id" = candidates."id"
    RETURNING
      task."id",
      task."subscriptionId",
      task."attempts",
      task."claimedAt"
  `);
}

type DeliveryOutcome = "sent" | "failed" | "paused" | "discarded";

function sameClaim(actual: Date | null, expected: Date): boolean {
  return actual?.getTime() === expected.getTime();
}

async function discardUndeliverableNotification(
  task: ClaimedNotification,
  pauseSubscription: boolean
): Promise<DeliveryOutcome> {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.subscriptionNotification.deleteMany({
      where: {
        id: task.id,
        status: "PROCESSING",
        claimedAt: task.claimedAt,
      },
    });
    if (removed.count !== 1) return "discarded";

    if (!pauseSubscription) return "discarded";
    const paused = await tx.subscription.updateMany({
      where: { id: task.subscriptionId, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });
    return paused.count === 1 ? "paused" : "discarded";
  });
}

async function deliverSubscriptionNotification(
  task: ClaimedNotification
): Promise<DeliveryOutcome> {
  const notification = await prisma.subscriptionNotification.findUnique({
    where: { id: task.id },
    select: {
      status: true,
      claimedAt: true,
      subscription: {
        select: {
          status: true,
          intervalDays: true,
          qty: true,
          user: { select: { name: true, email: true } },
          product: {
            select: {
              name: true,
              active: true,
              requiresPrescription: true,
            },
          },
        },
      },
    },
  });

  if (
    !notification ||
    notification.status !== "PROCESSING" ||
    !sameClaim(notification.claimedAt, task.claimedAt)
  ) {
    return "discarded";
  }

  const subscription = notification.subscription;
  if (subscription.status !== "ACTIVE") {
    return discardUndeliverableNotification(task, false);
  }

  const eligible = subscriptionReminderEligible({
    intervalDays: subscription.intervalDays,
    productActive: subscription.product.active,
    requiresPrescription: subscription.product.requiresPrescription,
    email: subscription.user.email,
  });
  if (!eligible) {
    return discardUndeliverableNotification(task, true);
  }

  const mail = subscriptionDueEmail(
    subscription.user.name,
    subscription.product.name,
    subscription.qty,
    `${baseUrl()}/conta/assinaturas`
  );
  const delivered = await sendMail({
    to: subscription.user.email,
    ...mail,
    idempotencyKey: subscriptionNotificationIdempotencyKey(task.id),
  });

  const completedAt = new Date();
  if (!delivered) {
    const failed = await prisma.subscriptionNotification.updateMany({
      where: {
        id: task.id,
        status: "PROCESSING",
        claimedAt: task.claimedAt,
      },
      data: {
        status: "FAILED",
        claimedAt: null,
        nextAttemptAt: subscriptionNotificationRetryAt(
          task.attempts,
          completedAt
        ),
        lastError: "Falha temporária no provedor de e-mail",
      },
    });
    return failed.count === 1 ? "failed" : "discarded";
  }

  return prisma.$transaction(async (tx) => {
    const sent = await tx.subscriptionNotification.updateMany({
      where: {
        id: task.id,
        status: "PROCESSING",
        claimedAt: task.claimedAt,
      },
      data: {
        status: "SENT",
        sentAt: completedAt,
        claimedAt: null,
        lastError: null,
      },
    });
    if (sent.count !== 1) return "discarded" as const;

    // O timestamp da assinatura muda apenas na mesma transação que confirma
    // a entrega do outbox como SENT.
    const updated = await tx.subscription.updateMany({
      where: { id: task.subscriptionId },
      data: { lastNotifiedAt: completedAt },
    });
    if (updated.count !== 1) {
      throw new Error("Assinatura da notificação enviada não encontrada");
    }
    return "sent" as const;
  });
}

export type SubscriptionDeliveryRun = {
  claimed: number;
  sent: number;
  failed: number;
  paused: number;
  discarded: number;
};

/** Processa um lote limitado; claims distintos podem rodar em paralelo sem colisão. */
export async function processSubscriptionNotifications(
  requestedLimit = 25
): Promise<SubscriptionDeliveryRun> {
  const tasks = await claimSubscriptionNotifications(requestedLimit);
  const outcomes: DeliveryOutcome[] = [];

  for (let index = 0; index < tasks.length; index += DELIVERY_CONCURRENCY) {
    outcomes.push(
      ...(await Promise.all(
        tasks
          .slice(index, index + DELIVERY_CONCURRENCY)
          .map(deliverSubscriptionNotification)
      ))
    );
  }

  return {
    claimed: tasks.length,
    sent: outcomes.filter((outcome) => outcome === "sent").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
    paused: outcomes.filter((outcome) => outcome === "paused").length,
    discarded: outcomes.filter((outcome) => outcome === "discarded").length,
  };
}
